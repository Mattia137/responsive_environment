/* =========================================================================
   ALLSPARK // IMPACT  ·  js/wrap-knowledge.js
   The Wrap Inspector content hub.

   For each of the 10 impact layers, four fields:
     sees        — 1-2 sentences on what is being modeled
     excludes    — 2-4 specific, citable, falsifiable exclusion claims
     demographics — who is counted, who is not (for layers with equity implications)
     political   — institutional/financial interests embedded in the dataset's design

   Standard: no vague hedge language. Every bullet is specific and falsifiable.
   Sources cited inline where applicable.
   ========================================================================= */

export const WRAP_NOTES = {

  /* ------------------------------------------------------------------ */
  air: {
    sees: `Construction-phase PM2.5 and NO₂ increases from haul-truck diesel emissions,
    modeled against an EPA AirNow baseline (or a static fallback of 8.4 µg/m³ when no
    live key is configured). Steady-state HVAC NOₓ is estimated from GFA × a fixed
    emissions coefficient.`,

    excludes: [
      `Indoor air quality is not modeled. Building service workers — janitors, security
      staff, loading dock operators — spend extended hours in mechanical rooms and service
      corridors with elevated particulate exposure. OSHA PEL for PM2.5 is 5 mg/m³,
      roughly 600× the ambient standard, which effectively excludes indoor workers from
      regulatory protection.`,

      `NYCCAS monitors are unevenly distributed: the South Bronx has 3 monitors for
      ~260,000 residents despite having asthma hospitalization rates 5× the citywide
      average (NYC DOHMH, 2021). The AirNow baseline used here reflects Manhattan
      monitor density, not the actual exposure gradient across community districts.`,

      `Diesel construction generators (typically 200–500 kW, operating 10+ hours/day
      during peak construction) are not modeled separately from haul-truck emissions.
      EPA Tier 4 Final standards apply to new equipment but are not enforced for
      equipment already in circulation at most NYC construction sites.`,

      `Emissions from museum visitor vehicle trips are not allocated to this layer;
      they appear partially — and incompletely — under transit pressure. The ~36%
      of visitors arriving by private vehicle generate localized CO and PM2.5 near
      the building entry that this model cannot place spatially.`,
    ],

    demographics: `The model counts outdoor exposure uniformly within the impact ring.
    It does not distinguish between people who spend more time outdoors — outdoor
    construction workers, street vendors, unhoused individuals, children in nearby
    parks — and those who do not. EJScreen data (EPA, 2023) shows the Hudson Yards
    study area has a diesel PM2.5 percentile already in the 62nd–70th range nationally
    before this project is added.`,

    political: `The NYC DOHMH NYCCAS monitor network was designed to model citywide
    air quality trends, not to provide hyperlocal environmental justice data. Monitor
    siting decisions reflect neighborhood political mobilization as much as health
    burden: community districts with active environmental advocacy (e.g., CB3
    Manhattan) have denser monitoring than districts with comparable or higher pollution
    loads but less institutional capacity.`,
  },

  /* ------------------------------------------------------------------ */
  power: {
    sees: `Annual operational energy demand derived from NYC LL84 Energy Use Intensity
    (EUI) benchmarks for the selected program type. Peak demand, operational CO₂e at
    NYISO Zone J grid intensity (0.28 kgCO₂e/kWh, 2024 annual average), and
    comparison against LL97 2024–29 limits.`,

    excludes: [
      `The grid carbon intensity of 0.28 kgCO₂e/kWh is a 2024 annual average.
      During summer peak demand periods (3–7pm weekdays), NYISO Zone J dispatches
      oil-fired peaker plants in Sunset Park and Astoria that push marginal carbon
      intensity to 0.55–0.75 kgCO₂e/kWh (Physicians, Scientists and Engineers for
      Healthy Energy, 2022). A cultural institution with peak demand coinciding with
      summer opening hours generates significantly higher real-world carbon than the
      annual average implies.`,

      `Renewable Energy Certificates (RECs) purchased by the building are not modeled.
      A building that claims 100% renewable energy via RECs sourced from out-of-state
      hydropower has not reduced local grid carbon or peaker plant dispatches. NYC's
      Local Law 97 compliance pathway allows REC-based carbon accounting, but the
      atmospheric effect is zero if the renewable capacity would have been built anyway.`,

      `Embodied energy in construction materials — the energy to manufacture steel,
      concrete, and glass — is not captured here. It appears in Cost & Logistics only
      as CO₂e, not as energy equivalent. For a typical Manhattan museum, embodied
      energy is roughly equivalent to 20–30 years of operational energy (NRDC,
      Embodied Carbon 101, 2023).`,

      `The model assumes the baseline building footprint has zero energy load.
      If the site contains existing structures (the Hudson Yards site included active
      rail infrastructure), demolition energy and the lost embodied carbon of the
      demolished structures are not counted.`,
    ],

    demographics: `Energy cost burdens fall unevenly: Con Edison utility rate increases
    driven by large commercial demand growth are passed to all ratepayers,
    disproportionately affecting low-income households that spend a higher share of
    income on utilities (average 8.6% for households below poverty line vs. 2.1%
    for median-income households; ACEEE, 2020).`,

    political: `NYC LL84 EUI benchmarks are derived from self-reported disclosure data.
    Building owners have historically under-reported by 8–15% (Urban Green Council,
    2019), meaning the benchmarks themselves encode the compliance behavior of large
    real estate owners. The LL97 cultural institution limit of 0.758 kgCO₂e/m²·yr
    was set through negotiation between the city and the Real Estate Board of New York
    (REBNY), not derived from climate physics or equity considerations.`,
  },

  /* ------------------------------------------------------------------ */
  pedestrian: {
    sees: `Annual visitor projections from program-specific density benchmarks calibrated
    to named comparable institutions (The Shed, Whitney Museum, MoMA PS1, Academy
    Museum). Peak-hour visitor concentration using a 0.0016 fraction of annual visitors.`,

    excludes: [
      `Time-of-day and day-of-week concentration is not modeled. A major cultural
      institution typically concentrates 60–75% of weekly visitors in Saturday/Sunday
      afternoon windows. The 10-block street network around Hudson Yards operates near
      pedestrian LOS C on ordinary weekday afternoons; a weekend opening event would
      push it to LOS E or F on specific corridors.`,

      `Service workers add 15–30% to daily building entries but use different street-level
      routes than visitors — typically arriving via service entrances on secondary streets,
      overlapping with school drop-off and residential pedestrian patterns in ways the
      aggregate entry count cannot reveal.`,

      `Existing pedestrian baseline counts are not incorporated. NYC DOT automated counts
      for this corridor are available but not fetched here. The model shows a delta but
      not total load, making it impossible to assess whether the corridor has remaining
      capacity or is already saturated.`,

      `Construction-phase sidewalk closures and pedestrian rerouting — which can force
      pedestrians into travel lanes on multi-block detours — are not modeled at any
      time step.`,
    ],

    demographics: `Visitor benchmarks are calibrated from high-profile institutions with
    predominantly non-local visitor bases (Whitney: 65% non-NYC tourists, per Whitney
    2019 annual report). Community-serving anchors with local visitor bases generate
    less measurable pedestrian pressure but more durable neighborhood use patterns.
    The model cannot distinguish between a visitor who drives from New Jersey and
    one who walks from Chelsea.`,

    political: `NYC DOT pedestrian counts use automated infrared counters and manual
    intercept surveys. Both methods systematically undercount informal commercial
    activity — street vendors, loading/unloading activity, informal day labor — that
    occupies the same sidewalk space and would be most directly displaced by increased
    formal pedestrian volume. Survey methodology was designed to support BID
    (Business Improvement District) streetscape investment decisions.`,
  },

  /* ------------------------------------------------------------------ */
  rent: {
    sees: `Anchor-institution rent uplift at four distance bands (100m, 250m, 400m, 800m),
    derived from Furman Center and Brookings anchor-effect meta-analyses. Scaled
    by the square root of GFA relative to 15,000 m² baseline. Represents
    5-year post-opening settled-state projection.`,

    excludes: [
      `Rent-stabilized units, which by law can only increase at rates set by the
      NYC Rent Guidelines Board (typically 2–4%/year), are affected differently from
      market-rate units — but this model applies the uplift coefficient uniformly
      across all residential units in the ring. Rent-stabilized tenants are partially
      shielded from the direct rent increase but face succession risk when units turn over.`,

      `The timing of the uplift is compressed: real estate research shows speculative
      rent and land value anticipation begins 18–36 months before a project opens, as
      investors acquire properties based on announced plans. The 5-year settled state
      shown here omits the construction-phase rent shock, which may be larger for
      immediately adjacent units.`,

      `Commercial rent uplift is not modeled. Anchor institutions raise retail rents
      in adjacent commercial corridors (Furman Center, 2019: 7–14% over 5 years for
      ground-floor commercial). This displaces existing local-serving retail before
      the institution opens — a cost that does not appear in any layer.`,

      `Shadow pricing — properties directly shaded by the new building losing solar
      access, or units facing the service entrance losing quiet enjoyment — may
      experience rent decreases. The model applies only positive uplift.`,
    ],

    demographics: `The model's implicit subject is the market-rate renter. Homeowners
    in the impact ring see property value increases. Rent-stabilized tenants are
    partially shielded from the direct rent increase but face landlord pressure through
    service reduction, harassment, and preferential offers to vacate. Informal housing
    arrangements — undocumented tenants paying cash rent with no formal lease — have
    no legal protection and no visibility in the datasets the model could use.`,

    political: `StreetEasy and Zillow listing data over-represents market-rate units
    (landlords of stabilized units have no incentive to list publicly) and skews toward
    professionally managed buildings with marketing infrastructure. MapPLUTO assessed
    values are optimized for property tax collection, not housing market reality:
    assessed values in rapidly gentrifying neighborhoods systematically lag behind
    actual sale prices by 20–40%, a pattern that benefits large property owners
    who can afford to contest assessments while under-taxing speculative land holdings.`,
  },

  /* ------------------------------------------------------------------ */
  displacement: {
    sees: `A hardcoded baseline of 1,840 rent-burdened households (a placeholder
    pending ACS API integration — the code comments confirm this). A linear scaling
    of at-risk households with project GFA. Long-tenure share and rent-stabilized
    units at risk estimated from fixed coefficients.`,

    excludes: [
      `Secondary displacement — residents who leave before formal eviction because they
      anticipate rising rents or perceive neighborhood change — is the largest category
      of displacement and is entirely invisible in eviction records, ACS data, or
      any administrative dataset. Scholars estimate secondary displacement may be
      3–5× the volume of formal eviction (Hartman & Robinson, 2003; Heidkamp &
      Lucas, 2006).`,

      `Commercial displacement of small businesses — which often precedes and accelerates
      residential displacement by transforming the neighborhood's service character —
      does not appear in this layer. A laundromat or Caribbean grocery closing is not
      an eviction, but it is a form of displacement that erodes the social fabric
      that makes a neighborhood livable for existing residents.`,

      `Property tax displacement affects homeowners, particularly long-tenured elderly
      homeowners on fixed incomes whose property taxes rise with assessed values.
      This process is slow, administrative, and nearly invisible in displacement
      research that focuses on tenant evictions.`,

      `ACS 5-year estimates undercount undocumented residents — estimated at 10–15%
      of the Hudson Yards–adjacent population (Fiscal Policy Institute, 2019). These
      residents have the highest displacement vulnerability (no legal tenancy
      protection, no eviction filing trail) and the lowest visibility in any dataset.`,
    ],

    demographics: `Unhoused individuals are entirely absent from ACS household data
    and from standard displacement metrics. Informal subletting arrangements — common
    in immigrant-dense neighborhoods — appear in ACS only as occupied units,
    with the formal leaseholder counted but not the additional residents.
    Mixed-status households (some members documented, some not) face compounded
    vulnerability: the documented members have legal standing, the undocumented
    do not, and eviction of the unit displaces both. HPD eviction filing data
    records the beginning of the legal process but not the outcome: most tenants
    leave before the case concludes, so the data shows the bureaucratic skeleton
    of displacement, not its human geography.`,

    political: `The displacement index as a single composite number is the move
    this platform's thesis criticizes most directly. It flattens four distinct
    causal pathways — rent burden, tenure disruption, eviction, commercial
    transformation — into a single headline that performs analytical confidence
    while suppressing the mechanisms that would inform intervention.
    The Furman Center's Displacement Risk Index, which this layer approximates,
    was designed for policy-level triage, not for individual project assessment.
    Using it at this scale is a category error that the model does not flag.`,
  },

  /* ------------------------------------------------------------------ */
  induced: {
    sees: `New storefront viability estimated from projected annual visitor spend,
    using a coefficient of 0.033 new storefronts per 1,000 annual visitors derived
    from post-occupancy studies of comparable anchor institutions. Divided into F&B
    (50%), retail (40%), and hospitality (10%).`,

    excludes: [
      `Chain displacement: anchor institutions in high-visibility corridors
      systematically attract national chains, which can afford above-market rents
      and offer landlords credit-worthy tenants. Local independent businesses — which
      were already present and serving the existing population — are displaced by
      the rent increase, not counted as new storefronts. The model adds; it does
      not subtract. Net storefront change may be zero or negative.`,

      `Storefront vacancy as an intermediate state is not modeled. When anchor demand
      raises ground-floor rents beyond what existing tenants can afford, units sit
      vacant while landlords await higher-rent tenants. The DCP Storefront Tracker
      documents Manhattan storefront vacancy at 15–20% in anchor-adjacent corridors
      (2019 data), a dynamic this model cannot capture.`,

      `Informal and unlicensed economic activity — street vendors, pop-up markets,
      mobile food carts — that serves the existing population is not counted as
      "induced demand" and is not protected by any framing that treats new
      registered storefronts as a positive metric.`,
    ],

    demographics: `The 0.033 coefficient is derived from studies of destination
    cultural institutions with affluent, non-local visitor bases. Institutions
    that primarily serve local residents (community arts centers, public libraries)
    generate less measurable commercial induced demand but create more social
    infrastructure for existing residents. The model conflates these two very
    different anchor types.`,

    political: `"Induced demand" as an impact category was developed in economic
    impact studies commissioned by development interests to justify public subsidies
    and tax incentives for cultural institutions. The Brookings Institution, which
    produced influential anchor-effect studies, received funding from foundation
    donors with interests in real estate development adjacent to anchor institutions.
    NYC SBS CDNA data is collected to support Business Improvement Districts,
    which are governed by commercial property owners and have no representation
    from tenant businesses or workers.`,
  },

  /* ------------------------------------------------------------------ */
  transit: {
    sees: `Additional daily transit entries from projected visitors, using program-specific
    transit mode share coefficients (64% for media museums). Load added to five
    nearest subway stations using real 2024 MTA baseline daily entries. Citi Bike
    incremental trips estimated at 15% of added transit volume.`,

    excludes: [
      `Platform crowding and wait time degradation are not modeled. Additional entries
      at 34 St-Hudson Yards (7 train) translate directly to reduced platform capacity
      for existing riders — predominantly West Side service workers — who have no
      alternative and bear the full cost of degraded service quality. The 7 train
      was already running at 103% capacity during AM peak in 2019 (MTA Blue Book).`,

      `Induced auto trips from visitors who do not take transit (36% by the model's
      own coefficient) — their parking pressure, street congestion, and idling emissions
      — are not modeled. Street parking in Hudson Yards is severely constrained;
      these visitors use the Lincoln Tunnel corridor and structure parking with
      documented PM2.5 impacts on the adjacent Hell's Kitchen neighborhood.`,

      `Construction-phase transit disruption — sidewalk closures, crosswalk
      eliminations, truck traffic that blocks bus routes, and haul-route streets
      that degrade walking access to stations — are not modeled at any time step.
      The 11th Avenue reconstruction for Hudson Yards Phase 1 closed the M23 bus
      route crosstown access for 18 months.`,
    ],

    demographics: `Existing 34 St-Hudson Yards station users are predominantly
    low-income service workers commuting from Queens via the 7 train, not the
    cultural institution's target audience. They bear the full cost of crowding
    as a negative externality of a project whose benefits flow to visitors.
    Citi Bike docks in Hudson Yards are disproportionately used by tourists and
    recreational cyclists, not by commuting workers: station turnover data (Citi
    Bike GBFS, 2023) shows mean trip duration of 22 minutes from Hudson Yards
    docks vs. 14 minutes citywide — evidence of recreational, not commute, use.`,

    political: `MTA ridership data is collected at the fare gate and captures only
    paying riders. Unbanked commuters using informal OMNY workarounds, youth riders
    using limited Metrocards, and service workers with irregular schedules who use
    multi-modal informal transport are systematically undercounted. MTA service
    allocation decisions are made by a board whose members are appointed by
    the Governor and NYC Mayor, with no direct representation from riders or
    the communities most dependent on transit.`,
  },

  /* ------------------------------------------------------------------ */
  cost: {
    sees: `Hard construction cost using Turner Construction Cost Index × Manhattan
    program-type benchmarks. Duration and haul-truck trips from NYC DOB regression.
    Embodied CO₂e for a default hybrid structural system from EC3 Building
    Transparency median values.`,

    excludes: [
      `Soft costs — design fees, permits, legal, financing, insurance, and
      owner's contingency — typically add 25–40% to hard cost for Manhattan
      institutional projects. A project modeled at $200M hard cost may carry
      $280M total development cost. Soft costs are borne by the developer
      but paid partly through public subsidy, philanthropy, and naming-rights deals.`,

      `Carrying costs during the construction period are not modeled. At 2024
      construction loan rates (6.5–7.5%), a $200M project accrues $13–15M/year
      in interest. For a 3.5-year build, this is $45–55M that must be recovered
      through future operations, often by raising admission prices.`,

      `Supply chain emissions in the embodied carbon figure use EC3 global median
      values. NYC-specific ready-mix concrete has lower carbon intensity than the
      global median (~25–30% lower, per NRDC 2023), so this model systematically
      overstates embodied carbon for concrete-heavy systems and understates it for
      steel imported from lower-standard international mills.`,

      `Community benefits agreements, public art fees (NYC requires 1% of capital
      costs for public art in certain projects), and ongoing public space maintenance
      obligations are not included in the capital cost, but represent real long-term
      fiscal commitments that affect operating margins.`,
    ],

    demographics: `The cost model is from the developer's perspective. Haul-truck
    trips translate to costs borne by adjacent residents — noise, PM2.5,
    pavement wear, pedestrian safety risk — that are externalized from the
    project budget entirely. Construction worker wages are not modeled: Turner
    Cost Index labor rates assume prevailing union wages; if the project uses
    non-union subcontractors (common in NYC specialty trades), workers receive
    lower wages while construction cost savings accrue to the developer.`,

    political: `The Turner Construction Cost Index is produced by Turner
    Construction Company, one of the largest general contractors in the US,
    with a financial interest in high cost benchmarks (higher benchmark =
    easier to justify contract bids). It is widely used in feasibility
    studies that support public subsidy applications to the NYC Mayor's
    Office, IDA, and NYCIDA. No independent public audit of the Turner
    index methodology has been conducted.`,
  },

  /* ------------------------------------------------------------------ */
  water: {
    sees: `Potable water demand from WBCSD/NYC DEP benchmarks by program type.
    Stormwater runoff increase from NOAA Atlas 14 2-year/24-hour design storm
    normalized by impervious footprint area. CSO outfall proximity flag
    for outfall OH-014 on the Hudson River.`,

    excludes: [
      `CSO probability is not computed. The model flags proximity to outfall OH-014
      but does not calculate the statistical probability that a given storm event
      will trigger a combined sewer overflow, or how many additional overflow events
      per year the added impervious area would cause. NYC DEP's CSO Long Term Control
      Plan contains this methodology but was not implemented here.`,

      `Groundwater impacts from construction dewatering are not modeled. Hudson Yards
      is built over the former West Side Yard, which sits above a high water table
      fed by underground streams. Deep foundation excavation requires continuous
      dewatering that can alter groundwater flow paths and affect adjacent building
      foundations — a risk documented in MTA's environmental review for the 7 train
      extension but absent from this model.`,

      `NOAA Atlas 14 precipitation frequency estimates for the Northeast were last
      updated in 2019 using data through 2015. Post-2015 storm intensification driven
      by climate change — including Hurricane Ida (2021), which delivered 3.1 inches/hour
      in Central Park, exceeding the 100-year storm threshold — is not reflected in
      the 2-year design storm used here. The Atlas 14 2-year storm is systematically
      underestimating current flood risk.`,
    ],

    demographics: `Downstream communities near CSO outfalls — the Hudson River
    waterfront, Newtown Creek, Gowanus Canal — bear the ecological and
    recreational cost of CSO events without proximity to the amenity that generates
    the additional runoff. The Bronx and Brooklyn communities adjacent to CSO-heavy
    sewer sheds face higher public health burdens from untreated sewage overflows
    than West Side Manhattan, yet the project's stormwater impact is measured
    only at the immediate outfall, not at the system-wide equity level.`,

    political: `NYC DEP stormwater management regulations (Local Law 5, 2021)
    require on-site retention for new development above certain thresholds,
    but compliance is measured at design submission, not at operational
    performance. The retrofit of DEP's Combined Sewer system is a
    multi-decade capital program funded by ratepayers; the water and
    sewer rates that fund it are regressive (flat-rate per unit,
    not income-scaled), meaning low-income households subsidize the
    stormwater infrastructure that serves new commercial development.`,
  },

  /* ------------------------------------------------------------------ */
  waste: {
    sees: `Operational solid waste from a visitor benchmark (0.85 lb/visitor,
    museum industry average). Ambient noise increase modeled logarithmically
    from annual visitor count against a baseline of 62 dB(A). Event-peak
    waste at 3.5× the daily average.`,

    excludes: [
      `Construction and demolition waste — which typically exceeds operational
      waste by 2–3 orders of magnitude over the project lifetime — is tracked
      under DSNY construction debris permits and is not modeled here. For a
      13,750 m² museum build, C&D waste is estimated at 2,000–4,000 tons
      (EPA C&D waste factors, 2018), compared to ~100 tons/year of operational
      waste.`,

      `Night-time noise from mechanical systems — HVAC condensers, cooling towers,
      exhaust fans — is not modeled. These sources operate continuously and at low
      frequency, which travels through building structures. The dB(A) ambient
      measurement standard used here is weighted to human speech frequencies and
      systematically underestimates low-frequency mechanical noise that residents
      in adjacent buildings report as the most disruptive.`,

      `Waste stream composition is not modeled. A cultural institution generates
      exhibition materials (plastics, metals, electronics), food service waste,
      and hazardous materials (paint, solvents, batteries) in proportions that
      differ significantly from the residential baseline implied by the per-visitor
      benchmark. Hazardous waste disposal is separately regulated and not captured.`,
    ],

    demographics: `Residents in buildings immediately adjacent to the building's
    loading dock — where waste is consolidated, refrigerated trucks idle, and
    early-morning collections occur — face acoustic and PM2.5 impacts far above
    the area-average dB increase shown in the model. Loading dock siting is an
    architectural decision that displaces noise and pollution onto specific
    neighbors, typically those in lower-value units with less political standing
    to contest it. Waste collection workers — predominantly immigrant workers
    from Brooklyn and the Bronx — bear occupational exposure to the increased
    waste load but are not counted in the project's impact area.`,

    political: `NYC SoundScore is a composite index derived from 311 noise complaints,
    not from acoustic measurements. Communities with higher 311 engagement —
    English-speaking, higher-income, more digitally connected — register higher
    SoundScores even if their actual noise environment is quieter than that of
    under-reporting communities. The 311 system therefore produces a map of civic
    engagement, not a map of acoustic harm. Using it as a noise baseline encodes
    this bias into every dB projection this layer makes.`,
  },

};
