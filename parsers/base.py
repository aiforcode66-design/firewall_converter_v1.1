# parsers/base.py
import re
from models import FirewallConfig

class BaseParser:
    """Kelas dasar untuk semua parser."""
    _RE_IS_MASK = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")

    def parse(self, **kwargs) -> FirewallConfig:
        raise NotImplementedError

    def _mask_to_cidr(self, mask: str) -> str:
        """Mengonversi netmask (255.255.255.0) ke panjang CIDR (24)."""
        if not mask or '.' not in mask:
            return "32"
        try:
            return str(sum(bin(int(x)).count('1') for x in mask.split('.')))
        except (ValueError, IndexError):
            return "32"
