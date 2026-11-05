"""Drawing registry for the 3D views: where each system and component sits, read from the dataset profile."""


def registry(profile) -> dict:
    SYSTEMS, AREAS = profile.systems, profile.areas
    COMPONENT_TO_SYSTEM = profile.component_to_system
    mounts = {**profile.mounts, **profile.shore_mounts}
    system_mounts = {**profile.system_mounts, **profile.shore_system_mounts}

    def areas_of(eic):
        return [area for area, (_, members) in AREAS.items() if any(key == eic for key, weight in members)]

    entries = []
    for eic, system in SYSTEMS.items():
        entries.append({"eic": eic, "system_eic": eic, "name": system["name"],
            "units": [unit for unit in profile.ship_ids if eic in profile.systems_for(unit)],
            "mounts": system_mounts.get(eic, []), "critical": system["critical"],
            "mission_areas": areas_of(eic),
            "components": [component["eic"] for component in system["components"]],
            "watchstations": [item["watchstation_code"] for item in system["required_quals"]]})
    # Components the dataset draws at their own location (e.g. a pump in a machinery space, away from its system).
    for comp, drawn in profile.component_mounts.items():
        parent = COMPONENT_TO_SYSTEM[comp]
        if not all(m in mounts for m in drawn["mounts"]):
            continue
        component = next(c for c in SYSTEMS[parent]["components"] if c["eic"] == comp)
        entries.append({"eic": comp, "system_eic": parent, "name": drawn["name"],
            "units": [unit for unit in profile.ship_ids if parent in profile.systems_for(unit)],
            "mounts": list(drawn["mounts"]), "critical": component["critical"], "mission_areas": areas_of(parent),
            "components": [], "watchstations": [q["watchstation_code"] for q in SYSTEMS[parent]["required_quals"]]})
    return {"model": profile.visual_model.get("model", ""), "hull_class": profile.visual_model.get("hull_class", ""),
        "mounts": mounts, "systems": entries, "component_to_system": COMPONENT_TO_SYSTEM,
        "mission_areas": {area: name for area, (name, members) in AREAS.items()},
        "layouts": profile.shore_layouts,
        "assessment_basis": "Event interval: six-hour and known-boundary checks; not a continuous guarantee"}
