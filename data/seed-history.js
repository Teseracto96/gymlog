/* Historial inicial importado de la app Strong (Smart Fit). Se carga sólo la primera vez. */
(() => {
  let n = 0;
  const id = () => 'seed' + (++n);
  const sets = (arr) => arr.map(([w, r, type = 'N']) => ({ id: id(), type, w, r, d: null, t: null, rpe: null, done: true }));
  const ex = (exId, arr) => ({ id: id(), exId, group: null, notes: '', sets: sets(arr) });

  window.SEED_HISTORY = [
    {
      id: 'seed-2026-10-31', name: 'Pecho-Tricep', start: '2026-10-31T14:28:00-07:00', end: null, notes: '', templateId: null,
      exercises: [
        ex('x_bench_press_bb', [[60, 10], [60, 12], [40, 10], [40, 11]]),
        ex('x_incline_bench_db', [[28, 8], [28, 8], [28, 6]]),
        ex('x_chest_press_machine', [[32, 12], [36, 12], [45, 8]]),
        ex('x_chest_fly', [[52, 12], [52, 12], [66, 10], [42, 12]]),
        ex('x_triceps_extension_cable', [[15, 20], [22, 13], [22, 12], [22, 13]]),
        ex('x_french_press_ez', [[17.5, 12], [17.5, 12], [20, 12]]),
        ex('x_close_grip_press_ez', [[17.5, 12], [17.5, 12], [20, 12]]),
        { id: id(), exId: 'x_walking', group: null, notes: '', sets: [{ id: id(), type: 'N', w: null, r: null, d: 1.5, t: 1800, rpe: null, done: true }] },
      ],
    },
    {
      id: 'seed-2026-11-02', name: 'Pierna', start: '2026-11-02T17:30:00-07:00', end: null, notes: '', templateId: null,
      exercises: [
        ex('x_lying_leg_curl_machine', [[41, 13], [54, 12], [54, 12], [54, 10]]),
        ex('x_leg_extension_machine', [[68, 12], [72, 12], [72, 12], [81, 12]]),
        ex('x_deficit_deadlift_bb', [[60, 10], [60, 10], [70, 10]]),
        ex('x_leg_press', [[160, 10], [180, 10], [200, 10]]),
        ex('x_calf_press_leg_press', [[80, 15], [120, 15], [120, 15], [120, 15]]),
      ],
    },
    {
      id: 'seed-2026-11-04', name: 'Espalda-Bicep', start: '2026-11-04T19:39:00-07:00', end: null, notes: '', templateId: null,
      exercises: [
        ex('x_lat_pulldown_cable', [[66, 10], [66, 8], [52, 10], [70, 10]]),
        ex('x_chin_up_assisted', [[-68, 6], [-68, 6], [-68, 5]]),
        ex('x_seated_row_cable', [[45, 12], [45, 14], [50, 12]]),
        ex('x_kneeling_pulldown_band', [[19.3, 12], [19.3, 12], [35, 10, 'D']]),
        ex('x_concentration_curl_db', [[10, 13], [10, 12], [10, 12], [10, 12]]),
        ex('x_bicep_curl_db', [[14, 10], [14, 11], [14, 11]]),
      ],
    },
  ];
})();
