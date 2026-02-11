# -*- coding: utf-8 -*-
"""
Parser service - encapsulates parsing logic from Flask app.
"""
import sys
import os

# Add parent directory to path to import from root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from models import FirewallConfig
from parsers.checkpoint_parser import CheckpointParser
from parsers.cisco_asa_parser import CiscoAsaParser
from parsers.fortinet_parser import FortinetParser
from parsers.palo_alto_parser import PaloAltoSetParser
from typing import Dict, Optional, BinaryIO
import zipfile
import fnmatch


class ParserService:
    """Service for parsing firewall configurations."""

    PARSER_MAP = {
        "cisco_asa": CiscoAsaParser,
        "checkpoint": CheckpointParser,
        "fortinet": FortinetParser,
        "palo_alto": PaloAltoSetParser,
    }

    GENERATOR_OPTIONS = {
        'fortinet': {
            'type': 'mixed',
            'fields': [
                'fortinet_ips',
                'fortinet_av',
                'fortinet_web',
                'fortinet_file',
                'fortinet_ssl',
                'fortinet_nat_mode'
            ]
        },
        'palo_alto': {
            'type': 'string',
            'fields': [
                'pa_av_profile',
                'pa_as_profile',
                'pa_vp_profile',
                'pa_url_profile',
                'pa_wf_profile',
                'pa_fb_profile',
                'pa_log_profile',
                'pa_output_mode',
                'pa_device_group',
                'pa_template'
            ]
        }
    }

    @classmethod
    def validate_uploaded_files(
        cls,
        source_vendor: str,
        files: Dict[str, Optional[BinaryIO]]
    ) -> None:
        """Validate uploaded files based on source vendor."""
        if source_vendor == 'checkpoint':
            has_objects = 'checkpoint_objects' in files and files['checkpoint_objects'] is not None
            has_policy = 'checkpoint_policy' in files and files['checkpoint_policy'] is not None
            has_csv_zip = 'checkpoint_csv_zip' in files and files['checkpoint_csv_zip'] is not None

            if not has_policy:
                raise ValueError("File policy (.csv) untuk Checkpoint diperlukan.")

            if not has_objects and not has_csv_zip:
                raise ValueError("File objects (.c) ATAU file ZIP CSV Objects diperlukan.")

            if has_objects:
                obj_name = files['checkpoint_objects'].filename.lower()
                if not obj_name.endswith('.c'):
                    raise ValueError("File objek Checkpoint harus berekstensi .c")

            if has_policy:
                pol_name = files['checkpoint_policy'].filename.lower()
                if not pol_name.endswith('.csv'):
                    raise ValueError("File policy Checkpoint harus berekstensi .csv")

        elif source_vendor in ['cisco_asa', 'fortinet', 'palo_alto']:
            if 'config_file' not in files or files['config_file'] is None:
                raise ValueError("Tidak ada file konfigurasi yang diunggah.")
            file = files['config_file']
            if file.filename == '':
                raise ValueError("Nama file kosong, silakan pilih file.")

    @classmethod
    async def parse_checkpoint_files(
        cls,
        parser,
        files: Dict[str, Optional[BinaryIO]]
    ) -> FirewallConfig:
        """Parse Checkpoint files."""
        objects_file = files.get('checkpoint_objects')
        policy_file = files.get('checkpoint_policy')
        nat_file = files.get('checkpoint_nat')
        config_file = files.get('checkpoint_config')
        csv_zip_file = files.get('checkpoint_csv_zip')

        objects_content = ""
        if objects_file and objects_file.filename != "":
            content = await objects_file.read()
            objects_content = content.decode('utf-8', errors='ignore')
            await objects_file.seek(0)

        policy_content = ""
        if policy_file and policy_file.filename != "":
            content = await policy_file.read()
            policy_content = content.decode('utf-8', errors='ignore')
            await policy_file.seek(0)

        nat_content = None
        if nat_file and nat_file.filename != "":
            content = await nat_file.read()
            nat_content = content.decode('utf-8', errors='ignore')
            await nat_file.seek(0)

        config_content = None
        if config_file and config_file.filename != "":
            content = await config_file.read()
            config_content = content.decode('utf-8', errors='ignore')
            await config_file.seek(0)

        # Handle CSV ZIP
        csv_objects = {}
        if csv_zip_file and csv_zip_file.filename != "":
            try:
                from io import BytesIO
                content = await csv_zip_file.read()
                zip_buffer = BytesIO(content)
                await csv_zip_file.seek(0)
                
                with zipfile.ZipFile(zip_buffer, 'r') as z:
                    file_list = z.namelist()
                    file_map = {name.lower(): name for name in file_list}

                    def get_content_by_pattern(pattern):
                        pat_lower = pattern.lower()
                        keys = sorted(file_map.keys())
                        matches = fnmatch.filter(keys, pat_lower)
                        valid_matches = [m for m in matches if '__macosx' not in m and not m.startswith('.')]

                        if valid_matches:
                            real_name = file_map[valid_matches[0]]
                            try:
                                return z.read(real_name).decode('utf-8')
                            except UnicodeDecodeError:
                                return z.read(real_name).decode('cp1252', errors='ignore')
                        return None

                    csv_objects['hosts'] = get_content_by_pattern('*add-host*.csv')
                    csv_objects['networks'] = get_content_by_pattern('*add-network*.csv')
                    csv_objects['ranges'] = get_content_by_pattern('*add-address-range*.csv')
                    csv_objects['groups'] = get_content_by_pattern('*add-group*.csv')
                    csv_objects['services_tcp'] = get_content_by_pattern('*add-service-tcp*.csv')
                    csv_objects['services_udp'] = get_content_by_pattern('*add-service-udp*.csv')
                    csv_objects['service_groups'] = get_content_by_pattern('*add-service-group*.csv')
            except Exception as e:
                print(f"Error reading ZIP file: {e}")

        return parser.parse(
            objects_content=objects_content,
            policy_content=policy_content,
            nat_content=nat_content,
            config_content=config_content,
            csv_objects=csv_objects
        )

    @classmethod
    async def parse_single_file(
        cls,
        parser,
        files: Dict[str, Optional[BinaryIO]]
    ) -> FirewallConfig:
        """Parse single config file (Cisco ASA, Fortinet, Palo Alto)."""
        file = files['config_file']
        content = await file.read()
        decoded_content = content.decode('utf-8', errors='ignore')
        await file.seek(0)
        return parser.parse(content=decoded_content)

    @classmethod
    async def parse_config(cls, source_vendor: str, files: Dict[str, Optional[BinaryIO]]) -> FirewallConfig:
        """
        Parse firewall configuration based on source vendor.

        Args:
            source_vendor: The source firewall vendor
            files: Dictionary of uploaded files

        Returns:
            FirewallConfig object

        Raises:
            ValueError: If validation fails or vendor not supported
        """
        cls.validate_uploaded_files(source_vendor, files)

        ParserClass = cls.PARSER_MAP.get(source_vendor)
        if not ParserClass:
            raise ValueError(f"Vendor sumber tidak didukung: {source_vendor}")

        parser = ParserClass()

        if source_vendor == 'checkpoint':
            config_data = await cls.parse_checkpoint_files(parser, files)
        elif source_vendor in ['cisco_asa', 'fortinet', 'palo_alto']:
            config_data = await cls.parse_single_file(parser, files)
        else:
            raise ValueError(f"Logika upload untuk {source_vendor} belum diimplementasikan.")

        # Sort rules and NAT rules by sequence
        if config_data.rules:
            config_data.rules.sort(key=lambda r: r.sequence_id)
        if config_data.nat_rules:
            config_data.nat_rules.sort(key=lambda nr: nr.sequence_id)

        return config_data

    @classmethod
    def get_vendor_capabilities(cls) -> Dict[str, Dict]:
        """Get capabilities for all supported vendors."""
        return {
            "cisco_asa": {
                "display_name": "Cisco ASA",
                "supports_zones": True,
                "supports_interfaces": True,
                "supports_aggregate_interfaces": False,
                "generator_options_type": None,
                "generator_options_fields": [],
            },
            "checkpoint": {
                "display_name": "Checkpoint",
                "supports_zones": True,
                "supports_interfaces": True,
                "supports_aggregate_interfaces": False,
                "generator_options_type": None,
                "generator_options_fields": [],
            },
            "fortinet": {
                "display_name": "Fortinet FortiGate",
                "supports_zones": True,
                "supports_interfaces": True,
                "supports_aggregate_interfaces": True,
                "generator_options_type": "mixed",
                "generator_options_fields": cls.GENERATOR_OPTIONS['fortinet']['fields'],
            },
            "palo_alto": {
                "display_name": "Palo Alto",
                "supports_zones": True,
                "supports_interfaces": True,
                "supports_aggregate_interfaces": False,
                "generator_options_type": "string",
                "generator_options_fields": cls.GENERATOR_OPTIONS['palo_alto']['fields'],
            },
        }
