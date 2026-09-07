# Nagpur DUCT — PALM-4U progress record

**Status as of 7 September 2026.** P0 and P1 complete. The static-driver chain
works end to end and PALM runs on real Nagpur geometry.

Driving run for the dynamic driver: **WRF v6** (`wrf_lcz_slucm_v6_96h`, SLUCM,
`AHOPTION=1`, gridded `FRC_URB2D`, road albedo 0.08). Chosen over v7 because v6
carries anthropogenic heat; BEP silently carries none. Deliberate, documented.

---

## 1. Pipeline

```
WRF-ARW 4.6.1  v6  d01 7.5 → d02 1.5 → d03 0.3 km
  apr2025_96h, 22–26 Apr 2025, 97 hourly wrfout_d03            [DONE]
        │
        ├────────────────────────────┐
        │                            │
        ▼                            ▼
  WRF4PALM                     GIS inputs                       [DONE]
  <case>_dynamic               • GBA footprints  757,922 city-wide
  [NOT STARTED — P2]             105,039 in root, height +2 m
                               • FABDEM DTM 30 m → zt @ 10 m
                               • OSM greens (88 polys), base = bare_soil
                                       │
                                       ▼
                                 palm_csd 25.10                 [DONE]
                                 nagpur_root  (PIDS static)
                                       │
                                       ▼
                            PALM-4U 25.10, 48 ranks             [P1 DONE]
                            LSM + USM + RTM
                                       │
                        ┌──────────────┴──────────────┐
                        ▼                             ▼
              10 m root, 4.8 km              2 m child, 960 m
              [running idealised]            [NOT STARTED — P4]
```

## 2. Domain geometry (settled)

| | root | child |
|---|---|---|
| extent | 4800 × 4800 m | 960 × 960 m |
| dx = dy = dz | 10 m | 2 m |
| nx = ny | 479 | 479 |
| origin (EPSG:32644) | 301080.0, 2336930.0 | 303000.0, 2338850.0 |
| origin lon/lat | 79.084693, 21.122739 | 79.102952, 21.140285 |
| decomposition | 8 × 6 = 48 ranks | 8 × 6 = 48 ranks |

Centred on **Mahal MPCB: 21.14472 N, 79.107595 E** (E 303488.2, N 2339335.3).

**The station is 477 m from WRF validation cell (i=60, j=50).** That snap was
deliberate on the WRF side — WUDAPT 0.6.0 misclassifies Mahal, so the cell was
moved to the nearest LCZ 3. At 2 m the snap is unnecessary because PALM resolves
the actual buildings. So PALM-vs-obs and WRF-vs-obs at "Mahal" compare points
477 m apart. Defensible — it is the microscale model's advantage — but it must
be stated in any table that puts the two tiers side by side.

**Domains are centred, not offset upwind.** Inflow at Mahal from v6 d03 is NW
day and night (322.5° / 315.3°, separation 7.1°), but daytime constancy is only
0.42 against 0.67 at night. With direction wandering during the UTCI-peak hours,
maximising the minimum fetch in all directions (480 m) beats maximising it in
one. Nights are both steadier and windier (4.17 vs 2.88 m/s), so nocturnal
results will be better constrained than daytime — the opposite of the usual
assumption.

## 3. Building heights — the binding input constraint

| | raw GBA | +2 m offset |
|---|---|---|
| mean height, 105,039 buildings in root | 3.57 m | 5.57 m |
| below 5 m (flattened at 10 m root, dz/2) | 85,635 (81.5%) | 45,766 (43.6%) |
| below 1 m (flattened at 2 m child, dz/2) | 4,746 (4.5%) | 0 |

Typology is 99.6% Residential (104,569 of 105,039), so the GBA→PALM
`building_type` mapping is nearly degenerate: everything to `residential_1950`,
then override `building_pars`.

**Mahal residential is typically 2–3 storeys, i.e. 6–9 m.** Even with the +2 m
offset the mean is 5.57 m, so GBA still under-represents by roughly a factor of
two. That propagates into canyon aspect ratio → MRT → UTCI. The +2 m is a
documented *display* correction from the DUCT viewer being reused as a physical
input; acceptable for a first run, not for a published UTCI field.

At driver level after rasterisation: mean 6.4 m, max 57.2 m, 26,901 of 78,342
building pixels below dz/2.

**This is the quantified case for the survey**, and the same figures are the
quantified case for the whole cascade: at 2 m Nagpur's built form exists in the
model, at 10 m it does not.

## 4. What P1 measured

PALM 25.10, 480 × 480 × 112, 48 ranks, 1 h simulated, 2834 timesteps.

| quantity | value |
|---|---|
| **throughput** | **2.04 × 10⁵ gridpoint-timesteps / core-s** |
| dt (advection-limited) | ~1.05 s |
| total wall clock | 7622 s (2.1 h) |
| `pres` (poisfft) | **46.55%** |
| `all progn.equations` | 35.85% |
| `radiation` | 0.02% |
| view-factor computation | 2 s |
| boundary-layer height | ~1600 m (vs 1500 m prescribed inversion) |
| w\* | ~2.0 m/s |
| div_new | ~1.2 × 10⁻⁵ |

**Two expectations were wrong.**

*RTM was not the cost risk.* I flagged SVF/raytracing repeatedly as the term
that could consume hours and tens of GB. It is 0.02% of runtime and 2 s of
setup at 10 m. It will grow at 2 m but cannot dominate.

*`poisfft` was the wrong solver choice.* Justified on fixed per-call cost from a
24k-point benchmark where `pres` was 6%. On the real 480² × 112 domain across
48 ranks it is 46.55% — the all-to-all transposes scale badly. A multigrid
comparison run is in progress; it is the single largest lever on the 2 m cost.

## 5. Revised cost projection (measured, not assumed)

dt scales with dx, so ~0.21 s at 2 m.

| configuration | steps / 24 h | wall clock |
|---|---|---|
| 10 m root, 24 h | ~68,000 | **2.1 days** |
| 4 m bring-up, 24 h | ~205,000 | **20 h** |
| 2 m child, 24 h | ~411,000 | **13.4 days** |
| 2 m child, 12 h window (06–18 IST) | ~205,000 | **6.7 days** |

Roughly double the earlier estimate. If multigrid halves `pres`: ~9 / 4.5 days.

Consequences: the 12-hour window is close to mandatory for production; do all
debugging at 4 m; and the 128-core / 1 TB procurement is what makes the intended
parent+child online nest (≈96 concurrent ranks against 52 physical cores)
affordable at all.

## 6. Corrections found along the way

Parameter names carried from the Prague paper (RTM 3.0 era) are consistently a
release or two behind 25.10. Verify against the `NAMELIST /.../` block in the
corresponding `*_mod.f90` in `MAKE_DEPOSITORY_default`, or against the shipped
cases in `palm_model_system-master/packages/palm/model/tests/cases/*/INPUT/`.

| wrong | correct in 25.10 |
|---|---|
| `raytrace_discret_azim` | `raytrace_discrete_azims` |
| `raytrace_discret_elev` | `raytrace_discrete_elevs` |
| `dist_max_svf` | does not exist |
| `surface_reflections` | does not exist |
| `read_wall_temp_3d` | not in `urban_surface_parameters` |

Other corrections:

- **`palm_csd` is not broken.** The v25.04 coordinate-shape bug is absent from
  the Feb 2026 master. GEO4PALM and a custom PIDS writer were both unnecessary.
- **`palm_csd` reads GPKG directly** (geopandas under the hood) — no shapefile
  conversion, and the `columns:` block maps source attributes to PALM concepts.
- **RRTMG is available.** The relative soname `rrtmg/rrtmg.so` is by design;
  palmrun stages it into the run directory.
- **`multigrid` is not mandatory** under non-cyclic boundaries — `poisfft` is
  legal provided `fft_method` is fftw/temperton/singleton.
- **LCZ path is a dead end for this work.** `palm_csd`'s `dcep: False` yields
  surfaces with no buildings at all; `dcep: True` yields bulk canyon parameters.
  Neither is a resolved-building driver. Also, the available LCZ raster is the
  300 m d03 grid in `LU_INDEX` encoding (values 5–40), too coarse regardless.
- **Vertical gradients are per 100 m**, not per metre.
- **`zt` must be a DTM.** FABDEM is correct; the four DSM products in the GEE
  export would have put buildings into the terrain field, then stacked GBA
  buildings on top.

Build gaps: no `__netcdf4` / `__netcdf4_parallel`, so output falls back to
64-bit offset and topography/surface-setup output cannot be written (`PAC0192`).
Worth rebuilding before P4.

## 7. Known deficiencies in the current static driver

Iteration-1 driver is deliberately minimal. In priority order:

1. **Pavement is 1.2%** — roads not included. The non-building domain is 64.8%
   "vegetation", almost all `bare_soil` from the base polygon. In a dense LCZ 3
   core this is a real thermal bias: bare soil carries soil moisture and
   evaporation through the LSM, asphalt does not. The OSM road network is
   already on the server and needs line→polygon buffering plus `street_type`.
2. **No trees.** `lad` / `root_area_dens_s` absent, so `plant_canopy_parameters`
   is off. Prague found 4–9 °C UTCI cooling from trees; UTCI without them is
   meaningless. `palm_csd` wants four attributes: tree height, crown diameter,
   trunk diameter, species — and synthesises the LAD profile itself.
3. **All 230,400 soil_type cells took the default (3).** Should come from WRF
   `ISLTYP` for consistency with the driving run.
4. **Building heights** (§3).
5. **`building_pars` not overridden** — European construction defaults.

## 8. Next

- **P2** — WRF4PALM against v6 wrfout. Sanity-check `init_soil_m` against
  `SMOIS`: soil moisture was the dominant unresolved error in the v4 lineage and
  propagates straight into PALM's surface energy balance.
- **P3** — spin-up (≥172800 s) plus a full diurnal cycle at 10 m, validated
  against MPCB and IMD Sonegaon with the same cRMSE / IoA metrics as the WRF
  workbook so the tiers are directly comparable.
- **P4** — Mahal AOI, 4 m bring-up then 2 m.
- **P5** — biometeorology (UTCI/PET/MRT) and the indoor model. The 19
  `building_indoor_pars` are the PALM analogue of the WRF BEM archetype block —
  same archetype quantities Kritika is deriving for CEA. Derive once in
  model-neutral form, project into three vocabularies. Caution: `cooling_factor`
  is a waste-heat factor, **not** COP; there is no `BLDAC_FRC` analogue, so AC
  penetration becomes a per-building attribute.

## 9. Divergences from the Prague precedent, to state explicitly

1. **WRF urban physics stays on.** Prague ran WRF with no urban parameterisation
   and left all urban processes to PALM. Air entering a 4.8 km domain in central
   Nagpur has genuinely crossed the city, so urbanised inflow is defensible —
   but it is the opposite choice and will be asked about.
2. **Offline nesting straight to the child, for now.** The intended 10 m parent
   + 2 m online nest does not fit 52 physical cores. Interim single-domain
   offline nesting means a 300 m → 2 m jump with all turbulence manufactured by
   the STG, and limited fetch.
3. **The indoor model is not optional here.** Prague ran with constant indoor
   temperature, justified by old apartment stock with no visible AC. Nagpur in
   late April is the opposite case.
