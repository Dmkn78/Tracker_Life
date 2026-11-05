"""Which provider URLs the API server may call.

The server makes the outbound request, so a URL is a server-side request:
- link-local, multicast and unspecified addresses are refused (cloud metadata endpoints);
- plain HTTP is only allowed towards loopback, private LAN or Tailscale addresses,
  so an API key never travels unencrypted over the Internet;
- credentials, query strings and fragments in the URL are refused.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit, urlunsplit

from .errors import AiProviderError

PrivateAddress = ipaddress.IPv4Address | ipaddress.IPv6Address

PRIVATE_NETWORKS = tuple(ipaddress.ip_network(network) for network in (
    "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "100.64.0.0/10", "::1/128", "fc00::/7",
))
INVALID_URL_MESSAGE = (
    "Adresse invalide : utilisez https:// pour un service distant, ou http:// vers localhost, "
    "une IP locale, LAN ou Tailscale. Les identifiants, paramètres et fragments ne sont pas acceptés."
)


def normalize_provider_base_url(base_url: str) -> str:
    """Return the canonical base URL (no trailing slash) or raise when the policy refuses it."""
    parsed = urlsplit(base_url.strip())
    hostname = (parsed.hostname or "").lower()
    if (
        parsed.scheme not in {"http", "https"}
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise AiProviderError(400, INVALID_URL_MESSAGE)
    literal_address = _parse_literal_address(hostname)
    if literal_address is not None and _is_forbidden_address(literal_address):
        raise AiProviderError(400, INVALID_URL_MESSAGE)
    if parsed.scheme == "http" and not _is_private_address(literal_address):
        raise AiProviderError(400, INVALID_URL_MESSAGE)
    netloc = _canonical_netloc(hostname, literal_address, parsed.port)
    normalized_url = urlunsplit((parsed.scheme, netloc, parsed.path.rstrip("/"), "", ""))
    return normalized_url


def ensure_resolved_host_allowed(base_url: str) -> None:
    """Refuse hostnames resolving to link-local/metadata addresses (checked right before calling)."""
    hostname = urlsplit(base_url).hostname or ""
    if _parse_literal_address(hostname) is not None:
        return
    try:
        resolved = {info[4][0] for info in socket.getaddrinfo(hostname, None)}
    except OSError as error:
        raise AiProviderError(503, f"Le nom d'hôte {hostname} est introuvable.") from error
    for address_text in resolved:
        if _is_forbidden_address(ipaddress.ip_address(address_text.split("%")[0])):
            raise AiProviderError(400, INVALID_URL_MESSAGE)


def _parse_literal_address(hostname: str) -> PrivateAddress | None:
    if hostname == "localhost":
        return ipaddress.ip_address("127.0.0.1")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        return None
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        return address.ipv4_mapped
    return address


def _is_forbidden_address(address: PrivateAddress) -> bool:
    return address.is_unspecified or address.is_multicast or address.is_link_local or address.is_reserved


def _is_private_address(literal_address: PrivateAddress | None) -> bool:
    if literal_address is None:
        return False
    return any(literal_address in network for network in PRIVATE_NETWORKS)


def _canonical_netloc(hostname: str, literal_address: PrivateAddress | None, port: int | None) -> str:
    # localhost is pinned to 127.0.0.1 so a DNS answer cannot redirect it.
    if literal_address is None:
        host = hostname
    elif isinstance(literal_address, ipaddress.IPv6Address):
        host = f"[{literal_address}]"
    else:
        host = str(literal_address)
    netloc = f"{host}:{port}" if port is not None else host
    return netloc
