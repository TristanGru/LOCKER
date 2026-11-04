from .domain import AREAS, COMPONENT_TO_SYSTEM, SYSTEMS


MOUNTS = {
    "air_radar": [16.5, 26, 0], "chill": [12, 4, 3.2],
    "vls_fwd": [33.9, 12, 0], "vls_aft": [-21.3, 12, 0],
    "engine_p": [-30, 4, -3.2], "engine_s": [-15, 4, 3.2],
    "genset_1": [-3, 4, -3.2], "genset_2": [24, 4, -3.2],
    "flight": [-55.2, 12, 0], "gun": [51.6, 14, 0],
    "sonar": [61.8, 3.6, 3.2], "sat": [1.5, 19, -7.5],
    "ciws": [-35.7, 20, 0], "steering": [-62, 4, 0],
    "navigation": [20, 24, 6], "operations": [8, 13, -3],
    "support": [4, 4, 3.2], "surface_launchers": [-11, 12, 7],
}
SYSTEM_MOUNTS = {
    "SPY1D": ["air_radar"], "CIWS": ["ciws"], "VLS": ["vls_fwd", "vls_aft"],
    "SQQ89": ["sonar"], "HELO": ["flight"], "GUN5": ["gun"], "SSM": ["surface_launchers"],
    "GTM": ["engine_p", "engine_s"], "SSDG": ["genset_1", "genset_2"],
    "STEER": ["steering"], "NAVRAD": ["navigation"], "HM": ["support"],
    "LAN": ["operations"], "COMMS": ["sat"],
}


def registry(profile=None):
    from .profile import default_profile
    profile = profile or default_profile()
    SYSTEMS, AREAS = profile.systems, profile.areas
    COMPONENT_TO_SYSTEM = profile.component_to_system
    mounts = profile.mounts or MOUNTS
    system_mounts = profile.system_mounts or SYSTEM_MOUNTS
    entries = []
    for eic, system in SYSTEMS.items():
        entries.append({"eic": eic, "system_eic": eic, "name": system["name"],
            "mounts": system_mounts.get(eic, []), "critical": system["critical"],
            "mission_areas": [area for area, (_, members) in AREAS.items() if any(key == eic for key, weight in members)],
            "components": [component["eic"] for component in system["components"]],
            "watchstations": [item["watchstation_code"] for item in system["required_quals"]]})
    if 'SPY1D-CW' in COMPONENT_TO_SYSTEM and 'chill' in mounts:
        entries.append({'eic': 'SPY1D-CW', 'system_eic': COMPONENT_TO_SYSTEM['SPY1D-CW'], 'name': 'Radar cooling water pump',
            'mounts': ['chill'], 'critical': True, 'mission_areas': ['AW'], 'components': [], 'watchstations': ['4310']})
    return {"model": "Illustrative DDG; not verified DTMB geometry or actual installed layout",
        "hull_class": "Notional Arleigh Burke-style destroyer", "mounts": mounts,
        "systems": entries, "component_to_system": COMPONENT_TO_SYSTEM,
        "mission_areas": {area: name for area, (name, members) in AREAS.items()},
        "assessment_basis": "Event interval: six-hour and known-boundary checks; not a continuous guarantee"}