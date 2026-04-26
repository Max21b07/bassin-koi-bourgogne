const CALC_RULES = {
  fountain: {
    confidence: "faible précision",
    method:
      "Estime l'effet de surface à partir du débit, de la hauteur de chute, de la profondeur et de la densité de poissons.",
    limits:
      "Ne mesure pas l'oxygène dissous réel et ne tient pas compte des pertes exactes de pompe, du vent ou de l'encrassement.",
  },
  volume: {
    confidence: "précision moyenne",
    method:
      "Multiplie longueur, largeur et profondeur moyenne avec un coefficient selon la forme du bassin.",
    limits:
      "Reste une estimation géométrique ; les berges, les pentes et les zones peu profondes peuvent modifier le volume réel.",
  },
  pump: {
    confidence: "précision moyenne",
    method:
      "Part d'un renouvellement visé selon le type de bassin, puis corrige selon la présence d'un filtre et d'une fontaine.",
    limits:
      "Ne remplace pas le calcul de hauteur manométrique ni la perte de charge réelle du circuit.",
  },
  air: {
    confidence: "précision moyenne",
    method:
      "Combine volume, profondeur, saison, température et charge en poissons pour proposer un ordre de grandeur prudent.",
    limits:
      "Le débit d'air utile dépend du diffuseur, de la contre-pression et du positionnement dans le bassin.",
  },
  population: {
    confidence: "faible précision",
    method:
      "Compare une charge biologique prudente à une capacité simplifiée du bassin, volontairement conservatrice.",
    limits:
      "Le calcul est volontairement prudent et ne suffit pas pour valider une surpopulation ou une jeune koï qui grandit.",
  },
  food: {
    confidence: "précision moyenne",
    method:
      "Applique une ration indicative selon la température de l'eau et le poids total estimé des poissons.",
    limits:
      "La consommation réelle dépend de l'activité, de l'espèce et de la qualité de l'eau.",
  },
  water: {
    confidence: "précision moyenne",
    method:
      "Interprète les valeurs de tests usuels avec une logique prudente et orientée sécurité.",
    limits:
      "Les seuils restent indicatifs ; seul un test fiable et répété dans le temps donne une vraie tendance.",
  },
  global: {
    confidence: "faible précision",
    method:
      "Agrège les indicateurs de volume, population, filtration, aération et qualité d'eau pour produire un diagnostic prudent.",
    limits:
      "Ne remplace ni une mesure d'oxygène dissous ni l'observation directe des poissons.",
  },
};

const SCENARIOS = [
  {
    title: "Bassin peu chargé",
    situation:
      "Poissons rouges seuls, peu de densité, filtration correcte et eau stable.",
    risk: "Équilibre probable",
    equipment:
      "Fontaine, filtre biologique correct et ombrage partiel suffisent souvent.",
    priority: "Surveiller la température et nourrir peu.",
  },
  {
    title: "Bassin mixte",
    situation: "Poissons rouges avec une jeune koï encore petite.",
    risk: "Vigilance",
    equipment:
      "Filtration sérieuse, fontaine utile, bulleur conseillé dès l'été.",
    priority: "Prévoir dès maintenant la croissance de la koï.",
  },
  {
    title: "Bassin à risque",
    situation: "Plusieurs koï ou trop de poissons pour 2,5 m³.",
    risk: "Risque",
    equipment:
      "Filtration renforcée, aération continue et surveillance rapprochée.",
    priority: "Réduire la population ou revoir la configuration.",
  },
  {
    title: "Canicule en Bourgogne",
    situation:
      "Eau chaude, nuit lourde, oxygène qui chute et poissons plus actifs.",
    risk: "Risque",
    equipment:
      "Bulleur indispensable, ombrage et réduction immédiate des rations.",
    priority: "Aérer avant tout et tester nitrites/ammoniaque.",
  },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value, precision = 0) => Number(value.toFixed(precision));
const format = (value) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(value));
const readNumber = (form, name) => Number(form.elements[name]?.value || 0);
const readValue = (form, name) => form.elements[name]?.value || "";

const badgeClass = (level) => {
  if (level === "ok") return "ok";
  if (level === "warn") return "warn";
  return "risk";
};

const badgeLabel = (level) => {
  if (level === "ok") return "Équilibre";
  if (level === "warn") return "Vigilance";
  return "Risque";
};

function resultTemplate({
  label = "Indice indicatif",
  title,
  level = "ok",
  confidence,
  method,
  limits,
  summary,
  details = [],
}) {
  const detailMarkup = details.length
    ? `<div class="result-notes">${details
        .map((item) => `<p>${item}</p>`)
        .join("")}</div>`
    : "";

  return `
    <div class="result-head">
      <div>
        <p class="result-label">${label}</p>
        <span class="result-number">${title}</span>
      </div>
      <span class="badge ${badgeClass(level)}">${badgeLabel(level)}</span>
    </div>
    <div class="gauge" aria-hidden="true"><span style="--value: ${clamp(
      level === "risk" ? 84 : level === "warn" ? 56 : 28,
      0,
      100,
    )}%"></span></div>
    <p class="result-summary">${summary}</p>
    <div class="calc-meta">
      <div>
        <span>Méthode</span>
        <p>${method}</p>
      </div>
      <div>
        <span>Fiabilité</span>
        <p>${confidence}</p>
      </div>
      <div>
        <span>Limites</span>
        <p>${limits}</p>
      </div>
    </div>
    ${detailMarkup}
  `;
}

function readFormState(type) {
  const form = document.querySelector(`form[data-calculator="${type}"]`);
  return form ? Object.fromEntries(new FormData(form).entries()) : {};
}

function renderResult(target, html) {
  target.innerHTML = html;
}

function renderFountain(form, target) {
  const flow = readNumber(form, "flow");
  const height = readNumber(form, "height");
  const depth = readNumber(form, "depth");
  const volume = Math.max(readNumber(form, "volume"), 1);
  const load = readValue(form, "load");

  const turnover = flow / volume;
  const flowScore = clamp((turnover / 0.8) * 38, 0, 38);
  const heightScore = clamp((height / 55) * 25, 0, 25);
  const surfaceScore = height > 15 ? 17 : height > 5 ? 9 : 3;
  const depthPenalty = depth > 90 ? 6 : depth < 45 ? 4 : 0;
  const loadPenalty = load === "high" ? 22 : load === "medium" ? 10 : 0;
  const index = clamp(
    flowScore + heightScore + surfaceScore - depthPenalty - loadPenalty + 12,
    0,
    100,
  );
  const level = index >= 70 ? "ok" : index >= 45 ? "warn" : "risk";
  const summary =
    index >= 70
      ? "La fontaine aide nettement la surface, mais elle ne suffit pas à elle seule si la charge biologique augmente."
      : index >= 45
        ? "La fontaine aide, mais un bulleur devient prudent dès que la chaleur monte ou que la population est dense."
        : "La fontaine seule paraît insuffisante pour un bassin chargé ; ajoutez une aération dédiée.";

  renderResult(
    target,
    resultTemplate({
      label: "Indice indicatif",
      title: `${format(index)} / 100`,
      level,
      confidence: CALC_RULES.fountain.confidence,
      method: CALC_RULES.fountain.method,
      limits: CALC_RULES.fountain.limits,
      summary,
      details: [
        `Renouvellement estimé par la fontaine : ${round(turnover, 2)} fois le volume par heure.`,
        "Le calcul ne mesure pas l'oxygène dissous réel.",
      ],
    }),
  );
}

function renderVolume(form, target) {
  const multipliers = { rectangle: 1, oval: 0.8, irregular: 0.65 };
  const shape = readValue(form, "shape");
  const volume =
    readNumber(form, "length") *
    readNumber(form, "width") *
    readNumber(form, "depth") *
    (multipliers[shape] || 1) *
    1000;
  const cubic = volume / 1000;
  const level = volume >= 2200 ? "ok" : volume >= 1400 ? "warn" : "risk";
  const summary =
    volume >= 2200
      ? "Volume cohérent avec un petit bassin familial, avec prudence sur la population."
      : volume >= 1400
        ? "Volume modeste : rester léger sur la population et sur l'alimentation."
        : "Volume très réduit : les koï deviennent vite inadaptées.";

  renderResult(
    target,
    resultTemplate({
      label: "Volume estimé",
      title: `${format(volume)} L · ${round(cubic, 2)} m³`,
      level,
      confidence: CALC_RULES.volume.confidence,
      method: CALC_RULES.volume.method,
      limits: CALC_RULES.volume.limits,
      summary,
      details: [
        "Le calcul reste géométrique et ne tient pas compte des formes complexes.",
      ],
    }),
  );
}

function renderPump(form, target) {
  const volume = Math.max(readNumber(form, "volume"), 1);
  const type = readValue(form, "type");
  const watts = readNumber(form, "watts");
  const price = readNumber(form, "price");
  const hasFilter = readValue(form, "filter") === "yes";
  const hasFountain = readValue(form, "fountain") === "yes";
  const rules = {
    ornamental: { minHours: 3, comfortHours: 2, label: "ornemental" },
    goldfish: { minHours: 2, comfortHours: 1.5, label: "poissons rouges" },
    koi: { minHours: 1.5, comfortHours: 1, label: "koï ou forte population" },
  };
  const rule = rules[type] || rules.goldfish;
  let minFlow = volume / rule.minHours;
  let comfortFlow = volume / rule.comfortHours;

  if (!hasFilter) {
    minFlow *= 1.2;
    comfortFlow *= 1.25;
  }

  const cost = watts > 0 && price > 0 ? (watts * 24 * 365 * price) / 1000 : 0;
  const level = type === "koi" || !hasFilter ? "warn" : "ok";

  renderResult(
    target,
    resultTemplate({
      label: "Fourchette prudente recommandée",
      title: `${format(minFlow)} à ${format(comfortFlow)} L/h`,
      level,
      confidence: CALC_RULES.pump.confidence,
      method: CALC_RULES.pump.method,
      limits: CALC_RULES.pump.limits,
      summary: `Débit conseillé pour un bassin ${rule.label}, avant les pertes de charge du circuit.`,
      details: [
        hasFountain
          ? "La fontaine aide la surface, mais le débit utile de filtration peut être inférieur au débit affiché."
          : "Sans fontaine, prévoyez un vrai brassage de surface ou une aération dédiée.",
        hasFilter
          ? "Filtration présente : viser un débit régulier et des supports biologiques propres."
          : "Sans filtre, le système reste fragile : ajouter une filtration biologique devient prioritaire.",
        cost
          ? `Coût électrique annuel estimatif : environ ${round(cost, 0)} € si la pompe tourne 24 h/24.`
          : "Renseigner la puissance et le prix du kWh permet d'estimer le coût annuel.",
      ],
    }),
  );
}

function renderAir(form, target) {
  const volume = Math.max(readNumber(form, "volume"), 1);
  const depth = readNumber(form, "depth");
  const goldfish = readNumber(form, "goldfish");
  const koi = readNumber(form, "koi");
  const season = readValue(form, "season");
  const temp = readNumber(form, "temp");

  let base = (volume / 1000) * 1.3;
  base += goldfish * 0.08;
  base += koi * 1.3;
  if (temp >= 24) base *= 1.55;
  if (temp >= 28) base *= 1.25;
  if (season === "été") base *= 1.25;
  if (season === "hiver") base *= 0.75;
  if (depth > 90) base *= 1.1;

  const minimal = Math.max(base, volume / 1000);
  const comfortable = minimal * 1.7;
  const diffusers = clamp(Math.ceil(comfortable / 4), 1, 4);
  const level = temp >= 25 || koi > 0 ? "warn" : "ok";

  renderResult(
    target,
    resultTemplate({
      label: "Débit d'air indicatif",
      title: `${round(minimal, 1)} à ${round(comfortable, 1)} L/min`,
      level,
      confidence: CALC_RULES.air.confidence,
      method: CALC_RULES.air.method,
      limits: CALC_RULES.air.limits,
      summary: `${diffusers} diffuseur${diffusers > 1 ? "s" : ""} est${diffusers > 1 ? "s" : ""} suggéré${diffusers > 1 ? "s" : ""} pour une aération prudente.`,
      details: [
        season === "hiver"
          ? "En hiver, gardez une zone libre sans brasser violemment toute la profondeur."
          : season === "été"
            ? "En été, aérer surtout la nuit et au petit matin reste une bonne sécurité."
            : "Aération régulière utile, à ajuster selon météo et activité des poissons.",
      ],
    }),
  );
}

function renderPopulation(form, target) {
  const volume = Math.max(readNumber(form, "volume"), 1);
  const goldfish = readNumber(form, "goldfish");
  const koi = readNumber(form, "koi");
  const size = readNumber(form, "size");
  const filtration = readValue(form, "filtration");
  const filterFactor =
    filtration === "strong" ? 1.2 : filtration === "correct" ? 1 : 0.68;
  const capacity = (volume / 1000) * 28 * filterFactor;
  const load =
    goldfish * Math.max(size, 8) * 0.55 + koi * Math.max(size, 15) * 3.8;
  const ratio = load / Math.max(capacity, 1);
  const index = clamp(ratio * 75, 0, 100);
  const level = ratio < 0.75 ? "ok" : ratio < 1.15 ? "warn" : "risk";
  const summary =
    level === "ok"
      ? "La charge estimée reste prudente pour un bassin de cette taille, avec observation régulière."
      : level === "warn"
        ? "La charge estimée devient sensible : renforcer filtration et aération, et ne pas ajouter de koï."
        : "La charge estimée paraît trop élevée pour rester serein dans 2,5 m³.";

  renderResult(
    target,
    resultTemplate({
      label: "Charge estimée",
      title: `${format(index)} / 100`,
      level,
      confidence: CALC_RULES.population.confidence,
      method: CALC_RULES.population.method,
      limits: CALC_RULES.population.limits,
      summary,
      details: [
        "Le calcul est volontairement prudent.",
        "Une koï adulte modifie rapidement l'équilibre biologique d'un petit bassin.",
      ],
    }),
  );
}

function renderFood(form, target) {
  const weight = readNumber(form, "weight");
  const temp = readNumber(form, "temp");
  let rate = 0;
  let level = "ok";
  let summary =
    "Pas de nourriture ou seulement une quantité symbolique si les poissons sont peu actifs.";

  if (temp >= 8 && temp < 12) {
    rate = 0.003;
    summary = "Ration légère, facile à digérer, avec observation attentive.";
  } else if (temp >= 12 && temp < 18) {
    rate = 0.006;
    summary = "Alimentation modérée, à retirer si non consommée rapidement.";
  } else if (temp >= 18 && temp <= 25) {
    rate = 0.01;
    summary = "Alimentation normale en petites prises, sans excès.";
  } else if (temp > 25) {
    rate = 0.005;
    level = "warn";
    summary = "Eau chaude : petites quantités, forte vigilance oxygène.";
  }

  const grams = weight * rate;

  renderResult(
    target,
    resultTemplate({
      label: "Ration indicative",
      title: `${round(grams, 1)} g/jour`,
      level,
      confidence: CALC_RULES.food.confidence,
      method: CALC_RULES.food.method,
      limits: CALC_RULES.food.limits,
      summary,
      details: [
        "Tout doit être consommé en quelques minutes.",
        "En cas de nitrites ou de poissons en surface, réduire ou arrêter.",
      ],
    }),
  );
}

function renderWater(form, target) {
  const temp = readNumber(form, "temp");
  const ph = readNumber(form, "ph");
  const kh = readNumber(form, "kh");
  const ammonia = readNumber(form, "ammonia");
  const nitrite = readNumber(form, "nitrite");
  const nitrate = readNumber(form, "nitrate");
  const messages = [];
  let risk = 0;

  if (temp > 25) {
    risk += 18;
    messages.push(
      "Température élevée : renforcer l'aération et fractionner la nourriture.",
    );
  }
  if (ph < 6.5 || ph > 8.5) {
    risk += 18;
    messages.push(
      "pH hors zone courante : éviter toute correction brutale, vérifier KH et stabilité.",
    );
  }
  if (kh < 4) {
    risk += 12;
    messages.push("KH bas : le pH peut devenir instable.");
  }
  if (ammonia > 0) {
    risk += ammonia >= 0.2 ? 35 : 20;
    messages.push(
      "Ammoniaque/ammonium détecté : réduire la nourriture, vérifier le filtre.",
    );
  }
  if (nitrite > 0) {
    risk += nitrite >= 0.2 ? 38 : 24;
    messages.push(
      "Nitrites détectables : alerte biologique, aération et réduction de nourriture.",
    );
  }
  if (nitrate > 50) {
    risk += 12;
    messages.push(
      "Nitrates élevés : plantes, changements partiels prudents et réduction des déchets.",
    );
  }
  if (!messages.length) {
    messages.push(
      "Lecture globalement rassurante, à confirmer par la stabilité dans le temps.",
    );
  }

  const level = risk < 20 ? "ok" : risk < 48 ? "warn" : "risk";

  renderResult(
    target,
    resultTemplate({
      label: "Lecture d'eau",
      title:
        level === "ok"
          ? "Lecture stable"
          : level === "warn"
            ? "À surveiller"
            : "Action rapide",
      level,
      confidence: CALC_RULES.water.confidence,
      method: CALC_RULES.water.method,
      limits: CALC_RULES.water.limits,
      summary: messages[0],
      details: messages.slice(1),
    }),
  );
}

function collectState() {
  return {
    volume: readFormState("volume"),
    fountain: readFormState("fountain"),
    pump: readFormState("pump"),
    air: readFormState("air"),
    population: readFormState("population"),
    food: readFormState("food"),
    water: readFormState("water"),
  };
}

function renderGlobalDiagnostic(target, actionsTarget) {
  const state = collectState();
  const water = state.water;
  const population = state.population;
  const fountain = state.fountain;
  const pump = state.pump;
  const air = state.air;
  const pondVolume = Math.max(
    Number(state.volume.length || 2.5) *
      Number(state.volume.width || 1.5) *
      Number(state.volume.depth || 0.8) *
      1000 *
      0.8,
    1,
  );
  const popVolume = Math.max(Number(population.volume || 2500), 1);
  const popGoldfish = Number(population.goldfish || 0);
  const popKoi = Number(population.koi || 0);
  const popSize = Number(population.size || 0);
  const popFiltration = population.filtration || "correct";
  const filterFactor =
    popFiltration === "strong" ? 1.2 : popFiltration === "correct" ? 1 : 0.68;
  const capacity = (popVolume / 1000) * 28 * filterFactor;
  const popLoad =
    popGoldfish * Math.max(popSize, 8) * 0.55 +
    popKoi * Math.max(popSize, 15) * 3.8;
  const popRatio = popLoad / Math.max(capacity, 1);
  const pumpMin = {
    ornamental: popVolume / 3,
    goldfish: popVolume / 2,
    koi: popVolume / 1.5,
  };
  const pumpComfort = {
    ornamental: popVolume / 2,
    goldfish: popVolume / 1.5,
    koi: popVolume / 1,
  };
  const pumpType = pump.type || "goldfish";
  const pumpComfortFlow = pumpComfort[pumpType] || popVolume / 1.5;
  const airComfort =
    Number(air.volume || 2500) / 1000 + popKoi * 1.2 + popGoldfish * 0.08;
  const waterRisk =
    (Number(water.nitrite || 0) > 0 ? 38 : 0) +
    (Number(water.ammonia || 0) > 0 ? 24 : 0) +
    (Number(water.temp || 0) > 25 ? 15 : 0) +
    (Number(water.kh || 0) < 4 ? 10 : 0) +
    (Number(water.ph || 0) < 6.5 || Number(water.ph || 0) > 8.5 ? 10 : 0) +
    (Number(water.nitrate || 0) > 50 ? 8 : 0);
  const pumpRisk =
    (readValue(
      document.querySelector('form[data-calculator="pump"]'),
      "filter",
    ) === "no"
      ? 12
      : 0) +
    (pumpComfortFlow < pumpMin[pumpType] ? 18 : 0) +
    (readValue(
      document.querySelector('form[data-calculator="pump"]'),
      "fountain",
    ) === "yes"
      ? 0
      : 6);
  const fountainRisk =
    (Number(fountain.flow || 0) < 1200 ? 12 : 0) +
    (Number(fountain.height || 0) < 15 ? 8 : 0) +
    (readValue(
      document.querySelector('form[data-calculator="fountain"]'),
      "load",
    ) === "high"
      ? 10
      : 0);
  const airRisk = airComfort < 2.5 ? 18 : airComfort < 4 ? 10 : 0;
  const populationRisk = popRatio < 0.75 ? 0 : popRatio < 1.15 ? 18 : 34;

  let score = clamp(
    waterRisk + pumpRisk + fountainRisk + airRisk + populationRisk,
    0,
    100,
  );
  let level = score < 25 ? "ok" : score < 55 ? "warn" : "risk";
  const title =
    level === "ok"
      ? "Équilibre probable"
      : level === "warn"
        ? "Vigilance"
        : "Risque";

  const actions = [];
  if (Number(water.nitrite || 0) > 0 || Number(water.ammonia || 0) > 0) {
    actions.push(
      "Tester nitrites et ammoniaque/ammonium, puis réduire la nourriture.",
    );
  }
  if (Number(water.temp || 0) > 25 || airRisk > 0) {
    actions.push("Ajouter un bulleur et ombrer partiellement le bassin.");
  }
  if (popKoi > 0 || populationRisk > 0) {
    actions.push("Éviter toute nouvelle koï et revoir la densité de poissons.");
  }
  if (pumpRisk > 0) {
    actions.push("Renforcer la filtration ou le débit utile de pompe.");
  }
  if (
    (document.querySelector('form[data-calculator="pump"]')?.elements.filter
      ?.value || "yes") === "no"
  ) {
    actions.push("Installer ou améliorer la filtration biologique.");
  }
  if (
    readValue(
      document.querySelector('form[data-calculator="air"]'),
      "season",
    ) === "été"
  ) {
    actions.push("Surveiller le bassin le soir et au petit matin.");
  }
  if (actions.length === 0) {
    actions.push("Continuer l'observation et rester léger sur la nourriture.");
  }

  renderResult(
    target,
    resultTemplate({
      label: "Diagnostic global",
      title,
      level,
      confidence: CALC_RULES.global.confidence,
      method: CALC_RULES.global.method,
      limits: CALC_RULES.global.limits,
      summary:
        level === "ok"
          ? "Le bassin semble cohérent avec une vigilance normale."
          : level === "warn"
            ? "Le bassin montre des signaux à surveiller et mérite quelques corrections."
            : "Plusieurs signaux se cumulent : agir rapidement sur l'oxygénation et la charge organique.",
      details: [
        `Volume estimé: ${format(pondVolume)} L, avec ${format(popLoad)} unités de charge prudente sur ${format(capacity)}.`,
        `Aération indicative: ${round(airComfort, 1)} L/min attendus en confort prudent.`,
      ],
    }),
  );

  if (actionsTarget) {
    actionsTarget.innerHTML = actions
      .slice(0, 5)
      .map((action) => `<span class="action-pill">${action}</span>`)
      .join("");
  }
}

function renderStaticContent() {
  const seasonCards = document.querySelector("#seasonCards");
  if (seasonCards) {
    seasonCards.innerHTML = [
      [
        "Printemps",
        "Redémarrer filtration, tester les nitrites et reprendre la nourriture progressivement.",
      ],
      [
        "Été",
        "Oxygénation maximale, ombrage partiel, attention aux algues, à l'évaporation et aux orages.",
      ],
      [
        "Automne",
        "Retirer les feuilles, réduire la nourriture et éviter l'accumulation de matières organiques.",
      ],
      [
        "Hiver",
        "Ne pas casser brutalement la glace, garder une zone libre et surveiller fontaine et pompe en cas de gel.",
      ],
    ]
      .map(
        ([title, text]) =>
          `<article class="info-card"><h4>${title}</h4><p>${text}</p></article>`,
      )
      .join("");
  }

  const plantCards = document.querySelector("#plantCards");
  if (plantCards) {
    const plants = [
      {
        title: "Nénuphars",
        text: "Ombre, refuge visuel et limitation de l'échauffement de surface.",
        svg: `<svg class="plant-icon" viewBox="0 0 260 140" aria-hidden="true"><ellipse cx="92" cy="74" rx="54" ry="22"/><ellipse cx="158" cy="82" rx="50" ry="20"/><path d="M124 96 C114 112 108 120 96 129"/><circle cx="134" cy="60" r="14" fill="#f4c86a"/></svg>`,
      },
      {
        title: "Plantes oxygénantes",
        text: "Aident l'équilibre et concurrencent les algues, sans remplacer un bulleur.",
        svg: `<svg class="plant-icon" viewBox="0 0 260 140" aria-hidden="true"><path d="M92 126 C90 86 98 58 122 24"/><path d="M126 126 C125 82 139 54 166 26"/><path d="M158 126 C164 86 184 62 212 42"/><ellipse cx="118" cy="43" rx="22" ry="8"/><ellipse cx="160" cy="49" rx="25" ry="8"/><ellipse cx="205" cy="58" rx="25" ry="8"/></svg>`,
      },
      {
        title: "Berges filtrantes",
        text: "Iris, joncs et plantes de berge captent une partie des nutriments.",
        svg: `<svg class="plant-icon" viewBox="0 0 260 140" aria-hidden="true"><path d="M80 126 C84 82 79 48 70 16"/><path d="M120 126 C121 76 134 44 150 16"/><path d="M170 126 C166 84 184 54 214 24"/><ellipse cx="70" cy="18" rx="8" ry="22"/><ellipse cx="150" cy="20" rx="8" ry="22"/><ellipse cx="212" cy="28" rx="8" ry="22"/></svg>`,
      },
    ];

    plantCards.innerHTML = plants
      .map(
        (plant) =>
          `<article class="info-card">${plant.svg}<h4>${plant.title}</h4><p>${plant.text}</p></article>`,
      )
      .join("");
  }

  const accordion = document.querySelector("#problemAccordion");
  if (accordion) {
    const problems = [
      [
        "Poissons en surface",
        "Manque d'oxygène, nitrites, chaleur, surpopulation.",
        "Élevée",
        "Ajouter aération, arrêter la nourriture, vérifier la pompe.",
        "Réduire la charge, renforcer filtre et bulleur.",
      ],
      [
        "Eau verte",
        "Algues en suspension, soleil, nitrates, filtre jeune.",
        "Moyenne",
        "Limiter la nourriture, vérifier UV/filtration, ombrer.",
        "Plantes, filtration biologique, population prudente.",
      ],
      [
        "Eau trouble",
        "Particules, bactéries, remuage du fond, excès de nourriture.",
        "Moyenne",
        "Contrôler le filtre, retirer les déchets visibles.",
        "Améliorer la préfiltration et éviter la suralimentation.",
      ],
      [
        "Algues filamenteuses",
        "Lumière, nutriments, faible concurrence végétale.",
        "Faible à moyenne",
        "Retirer manuellement sans tout décaper.",
        "Ombrage, plantes, réduction des nitrates.",
      ],
      [
        "Mousse",
        "Protéines dissoutes, agitation, déchets organiques.",
        "Moyenne",
        "Écumer, réduire la nourriture, vérifier l'odeur.",
        "Entretien du filtre et charge biologique plus faible.",
      ],
      [
        "Odeur",
        "Décomposition, zone morte, vase excessive.",
        "Élevée",
        "Aérer, retirer les matières en décomposition.",
        "Circulation, entretien doux du fond, filtration adaptée.",
      ],
      [
        "Poissons apathiques",
        "Température, nitrites, parasites, manque d'oxygène.",
        "Élevée",
        "Tester l'eau, augmenter l'aération, observer la respiration.",
        "Stabilité, quarantaine des nouveaux poissons.",
      ],
      [
        "Fontaine qui gèle",
        "Gel nocturne, faible débit, tuyau exposé.",
        "Moyenne",
        "Sécuriser la pompe, garder une zone libre.",
        "Prévoir un mode hiver et une protection des tuyaux.",
      ],
      [
        "Pompe encrassée",
        "Feuilles, vase, préfiltre saturé.",
        "Moyenne",
        "Nettoyer le préfiltre sans stériliser le média bio.",
        "Panier de protection et entretien régulier.",
      ],
    ];

    accordion.innerHTML = problems
      .map(
        ([title, causes, urgency, immediate, longTerm], index) => `
          <details class="problem-panel" ${index === 0 ? "open" : ""}>
            <summary>${title}</summary>
            <div class="problem-body">
              <div><strong>Causes probables</strong><p>${causes}</p></div>
              <div><strong>Urgence</strong><p>${urgency}</p></div>
              <div><strong>Actions immédiates</strong><p>${immediate}</p></div>
              <div><strong>Long terme</strong><p>${longTerm}</p></div>
            </div>
          </details>
        `,
      )
      .join("");
  }

  const scenarioCards = document.querySelector("#scenarioCards");
  if (scenarioCards) {
    scenarioCards.innerHTML = SCENARIOS.map(
      (scenario) => `
        <article class="scenario-card">
          <div class="scenario-head">
            <h4>${scenario.title}</h4>
            <span class="badge ${scenario.risk === "Risque" ? "risk" : scenario.risk === "Vigilance" ? "warn" : "ok"}">${scenario.risk}</span>
          </div>
          <p><strong>Situation</strong> ${scenario.situation}</p>
          <p><strong>Équipement conseillé</strong> ${scenario.equipment}</p>
          <p><strong>Action prioritaire</strong> ${scenario.priority}</p>
        </article>
      `,
    ).join("");
  }

  renderMobileTables();
}

function renderMobileTables() {
  document.querySelectorAll("table[data-mobile-cards]").forEach((table) => {
    const key = table.dataset.mobileCards;
    const container = document.querySelector(`[data-table-cards="${key}"]`);
    if (!container) return;

    const headers = [...table.querySelectorAll("thead th")].map((th) =>
      th.textContent.trim(),
    );
    const rows = [...table.querySelectorAll("tbody tr")];

    container.innerHTML = rows
      .map((row) => {
        const cells = [...row.children].map((cell) => cell.textContent.trim());
        const title = cells[0] || "";
        const items = cells.slice(1).map((value, index) => {
          const label = headers[index + 1] || `Champ ${index + 1}`;
          return `<p><strong>${label}</strong><span>${value}</span></p>`;
        });
        return `<article class="mobile-card"><h4>${title}</h4>${items.join("")}</article>`;
      })
      .join("");
  });
}

function bindAudioPanels() {
  const openAudios = new Set();

  document.querySelectorAll("[data-audio-toggle]").forEach((button) => {
    const key = button.dataset.audioToggle;
    const card = button.closest(".audio-card");
    const panel = card?.querySelector(".audio-panel");
    const audio = panel?.querySelector("audio");
    if (!panel || !audio) return;

    const panelId = panel.id || `audio-panel-${key}`;
    panel.id = panelId;
    button.setAttribute("aria-controls", panelId);
    button.setAttribute("aria-expanded", "false");

    const status = document.createElement("p");
    status.className = "audio-note";
    status.textContent =
      "Audio généré localement à partir de la voix du propriétaire du site.";
    panel.appendChild(status);

    audio.addEventListener("play", () => {
      document.querySelectorAll(".audio-card audio").forEach((other) => {
        if (other !== audio) other.pause();
      });
      openAudios.add(key);
    });

    audio.addEventListener("error", () => {
      status.textContent =
        "Fichier audio absent pour l’instant. Ajoutez le MP3 dans /audio pour activer cette capsule.";
    });

    button.addEventListener("click", () => {
      const isOpen = panel.hidden;
      panel.hidden = !isOpen;
      button.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) {
        audio.load?.();
      } else {
        audio.pause();
      }
    });
  });
}

function bindCalculators() {
  const handlers = {
    fountain: renderFountain,
    volume: renderVolume,
    pump: renderPump,
    air: renderAir,
    population: renderPopulation,
    food: renderFood,
    water: renderWater,
  };

  document.querySelectorAll("form[data-calculator]").forEach((form) => {
    const type = form.dataset.calculator;
    const target = document.querySelector(`[data-result="${type}"]`);
    const handler = handlers[type];
    if (!target || !handler) return;

    target.setAttribute("aria-live", "polite");
    target.setAttribute("aria-atomic", "true");

    const update = () => {
      handler(form, target);
      const globalTarget = document.querySelector(`[data-result="global"]`);
      const globalActions = document.querySelector("[data-global-actions]");
      if (globalTarget) {
        renderGlobalDiagnostic(globalTarget, globalActions);
      }
    };

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      update();
    });
    update();
  });
}

function bindTheme() {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem("pond-theme");
    if (saved === "light") root.classList.add("light");
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }

  document.querySelector(".theme-toggle")?.addEventListener("click", () => {
    root.classList.toggle("light");
    const isLight = root.classList.contains("light");
    try {
      localStorage.setItem("pond-theme", isLight ? "light" : "dark");
    } catch {
      // Ignore persistence errors.
    }
    const srText = document.querySelector(".theme-toggle .sr-only");
    if (srText) {
      srText.textContent = `Thème actuel : ${isLight ? "clair" : "sombre"}`;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderStaticContent();
  bindAudioPanels();
  bindCalculators();
  bindTheme();

  const globalTarget = document.querySelector(`[data-result="global"]`);
  const globalActions = document.querySelector("[data-global-actions]");
  if (globalTarget) {
    renderGlobalDiagnostic(globalTarget, globalActions);
  }
});
