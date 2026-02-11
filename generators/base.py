# -*- coding: utf-8 -*-
from abc import ABC, abstractmethod
from typing import Dict, Optional
from models import FirewallConfig


class BaseGenerator(ABC):
    """
    Kelas dasar untuk semua generator.
    Mendukung Interface & Zone Mapping secara Universal.
    """

    def __init__(self, config: FirewallConfig, interface_map: Optional[Dict[str, str]] = None,
                 zone_map: Optional[Dict[str, str]] = None, **kwargs):
        self.config = config
        self.interface_map = interface_map or {}
        self.zone_map = zone_map or {}

        # Simpan opsi tambahan
        for key, value in kwargs.items():
            setattr(self, key, value)

    def _create_buffer(self):
        import io
        return io.StringIO()

    def get_target_interface(self, source_intf: str) -> str:
        """Universal Mapping: Mengambil nama interface target."""
        if not source_intf: return ""
        # Priority: Mapping > Original
        mapped = self.interface_map.get(source_intf, source_intf)
        return mapped.strip() or source_intf

    def get_target_zone(self, source_zone: str) -> str:
        """Universal Mapping: Mengambil nama zone target."""
        if not source_zone: return "any"
        mapped = self.zone_map.get(source_zone, source_zone)
        return mapped.strip() or source_zone

    def _cidr_to_mask(self, cidr_str):
        try:
            cidr = int(cidr_str)
            mask = (0xffffffff << (32 - cidr)) & 0xffffffff
            return "{}.{}.{}.{}".format((mask >> 24) & 0xff, (mask >> 16) & 0xff, (mask >> 8) & 0xff, mask & 0xff)
        except (ValueError, TypeError):
            return "255.255.255.255"

    @abstractmethod
    def generate(self) -> str:
        pass