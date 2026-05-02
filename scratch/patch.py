import re

with open('scratch/impact-model.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Add getUncertainty helper
helper = """
/* ================================================================
   UNCERTAINTY HELPER
   ================================================================ */
function getUncertainty(val, timeStep) {
  if (timeStep < 2 || typeof val !== 'number' || isNaN(val)) return undefined;
  const spread = (timeStep - 1) * 0.1; // T2: 10%, T3: 20%, T4: 30%
  return [val * (1 - spread), val * (1 + spread)];
}

function attachUncertainty(metricObj, val, timeStep) {
  const u = getUncertainty(val, timeStep);
  if (u) metricObj.uncertainty = u;
  return metricObj;
}
"""

code = code.replace("/* ================================================================\n   LAYER PROJECTIONS", helper + "\n/* ================================================================\n   LAYER PROJECTIONS")

# Update each project function to accept timeStep
def add_timestep(match):
    return match.group(1) + ', timeStep) {'

code = re.sub(r'(export function project\w+\(geometry, program, context)\) {', add_timestep, code)

# 1. Air Quality
code = code.replace(
    "const truck_trips   = gfa * COEFFICIENTS.CONSTRUCTION.truck_trips_per_1000m2 / 1000;",
    "const truck_trips   = (timeStep === 1) ? gfa * COEFFICIENTS.CONSTRUCTION.truck_trips_per_1000m2 / 1000 : 0;"
).replace(
    "const trucks_per_day_peak = (truck_trips / (months_build * 22)) * 1.6;",
    "const trucks_per_day_peak = (timeStep === 1) ? (truck_trips / (months_build * 22)) * 1.6 : 0;"
).replace(
    "const no2_proj  = baseline.no2  + gfa * 0.015 / 1000 * 0.9;",
    "const no2_proj  = baseline.no2  + (timeStep >= 2 ? gfa * 0.015 / 1000 * 0.9 : 0);"
).replace(
    "value: pm25_proj.toFixed(1)",
    "value: pm25_proj.toFixed(1), uncertainty: getUncertainty(pm25_proj, timeStep)"
)

# 2. Power
code = code.replace(
    "const eui = COEFFICIENTS.EUI_BY_PROGRAM[program.type] ?? 300;",
    "const eui = (timeStep >= 2) ? (COEFFICIENTS.EUI_BY_PROGRAM[program.type] ?? 300) : 0;"
).replace(
    "value: (annual_kWh / 1000).toFixed(0),",
    "value: (annual_kWh / 1000).toFixed(0), uncertainty: getUncertainty(annual_kWh / 1000, timeStep),"
)

# 3. Pedestrian
code = code.replace(
    "const annual_visitors = gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0);",
    "const annual_visitors = (timeStep >= 2) ? gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0) : 0;"
).replace(
    "value: (annual_visitors / 1000).toFixed(0) + 'k',",
    "value: (annual_visitors / 1000).toFixed(0) + 'k', uncertainty: getUncertainty(annual_visitors / 1000, timeStep),"
)

# 4. Rent
code = code.replace(
    "const scale_factor = Math.sqrt(gfa / 15000);  // larger projects = stronger anchor",
    "const scale_factor = (timeStep >= 2) ? Math.sqrt(gfa / 15000) * (timeStep / 3) : 0;"
).replace(
    "value: `+${(COEFFICIENTS.ANCHOR_RENT_UPLIFT[2].pct * 100 * scale_factor).toFixed(1)}%`,",
    "value: `+${(COEFFICIENTS.ANCHOR_RENT_UPLIFT[2].pct * 100 * scale_factor).toFixed(1)}%`, uncertainty: getUncertainty(COEFFICIENTS.ANCHOR_RENT_UPLIFT[2].pct * 100 * scale_factor, timeStep),"
)

# 5. Displacement
code = code.replace(
    "const scale_factor = Math.sqrt(gfa / 15000);",
    "const scale_factor = (timeStep >= 2) ? Math.sqrt(gfa / 15000) * (timeStep / 3) : 0;"
).replace(
    "value: `+${at_risk_projected - at_risk_baseline}`,",
    "value: `+${at_risk_projected - at_risk_baseline}`, uncertainty: getUncertainty(at_risk_projected - at_risk_baseline, timeStep),"
)

# 6. Induced
code = code.replace(
    "const annual_visitors = gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0);",
    "const annual_visitors = (timeStep >= 2) ? gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0) : 0;"
).replace(
    "value: `+${new_storefronts}`,",
    "value: `+${new_storefronts}`, uncertainty: getUncertainty(new_storefronts, timeStep),"
)

# 7. Transit
code = code.replace(
    "const annual_visitors = gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0);",
    "const annual_visitors = (timeStep >= 2) ? gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0) : 0;"
).replace(
    "value: `+${Math.round(daily_entries).toLocaleString()}`,",
    "value: `+${Math.round(daily_entries).toLocaleString()}`, uncertainty: getUncertainty(daily_entries, timeStep),"
)

# 8. Cost
code = code.replace(
    "const trucks     = gfa * COEFFICIENTS.CONSTRUCTION.truck_trips_per_1000m2 / 1000;",
    "const trucks     = (timeStep === 1) ? gfa * COEFFICIENTS.CONSTRUCTION.truck_trips_per_1000m2 / 1000 : 0;"
).replace(
    "value: `$${(total_cost/1e6).toFixed(0)}M`,",
    "value: `$${(total_cost/1e6).toFixed(0)}M`, uncertainty: getUncertainty(total_cost/1e6, timeStep),"
)

# 9. Water
code = code.replace(
    "const potable_gpd    = gfa * (COEFFICIENTS.WATER_BY_PROGRAM[program.type] ?? 500) / 365 * 0.264;",
    "const potable_gpd    = (timeStep >= 2) ? gfa * (COEFFICIENTS.WATER_BY_PROGRAM[program.type] ?? 500) / 365 * 0.264 : 0;"
).replace(
    "const runoff_gpd     = footprint * COEFFICIENTS.RUNOFF_GPD_PER_M2_IMPERVIOUS * 1000;",
    "const runoff_gpd     = footprint * COEFFICIENTS.RUNOFF_GPD_PER_M2_IMPERVIOUS * 1000 * (timeStep === 1 ? 1.5 : 1.0);"
).replace(
    "value: `+${(runoff_gpd/1000).toFixed(1)}k`,",
    "value: `+${(runoff_gpd/1000).toFixed(1)}k`, uncertainty: getUncertainty(runoff_gpd/1000, timeStep),"
)

# 10. Waste
code = code.replace(
    "const waste_lb_per_day = annual_visitors * COEFFICIENTS.WASTE_LB_PER_VISITOR / 365;",
    "const waste_lb_per_day = (timeStep >= 2) ? annual_visitors * COEFFICIENTS.WASTE_LB_PER_VISITOR / 365 : 0;"
).replace(
    "const dB_delta         = 10 * Math.log10(1 + annual_visitors / 1e6);",
    "const dB_delta         = (timeStep === 1) ? 18.0 : ((timeStep >= 2) ? 10 * Math.log10(1 + annual_visitors / 1e6) : 0);"
).replace(
    "value: `${Math.round(waste_lb_per_day).toLocaleString()}`,",
    "value: `${Math.round(waste_lb_per_day).toLocaleString()}`, uncertainty: getUncertainty(waste_lb_per_day, timeStep),"
)

# Now iterate over metrics arrays and attachUncertainty where possible
# This is a bit tricky with regex, so let's just write the patched JS.

with open('scratch/impact-model-patched.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched successfully")
