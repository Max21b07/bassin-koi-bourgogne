const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const number = (form, name) => Number(form.elements[name]?.value || 0);
const choice = (form, name) => form.elements[name]?.value || "";
const round = (value, precision = 0) => Number(value.toFixed(precision));
const format = (value) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(value));

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
  value,
  unit = "",
  level = "ok",
  title,
  text,
  details = [],
}) {
  const safeValue = clamp(Number(value) || 0, 0, 100);
  const detailMarkup = details.map((item) => `<p>${item}</p>`).join("");

  return `
    <div class="result-head">
      <span class="result-number">${title || `${format(value)}${unit}`}</span>
      <span class="badge ${badgeClass(level)}">${badgeLabel(level)}</span>
    </div>
    <div class="gauge" aria-hidden="true"><span style="--value: ${safeValue}%"></span></div>
    <p>${text}</p>
    ${detailMarkup}
  `;
}

function renderFountain(form, target) {
  const flow = number(form, "flow");
  const height = number(form, "height");
  const depth = number(form, "depth");
  const volume = Math.max(number(form, "volume"), 1);
  const load = choice(form, "load");

  const turnover = flow / volume;
  const flowScore = clamp((turnover / 0.8) * 38, 0, 38);
  const heightScore = clamp((height / 55) * 25, 0, 25);
  const surfaceScore = height > 15 ? 17 : height > 5 ? 9 : 3;
  const depthPenalty = depth > 90 ? 6 : depth < 45 ? 4 : 0;
  const loadPenalty = load === "high" ? 22 : load === "medium" ? 10 : 0;
  const score = clamp(
    flowScore + heightScore + surfaceScore - depthPenalty - loadPenalty + 12,
    0,
    100,
  );
  const level = score >= 70 ? "ok" : score >= 45 ? "warn" : "risk";
  const recommendation =
    score >= 70
      ? "Fontaine probablement suffisante pour une population raisonnable, avec surveillance en été."
      : score >= 45
        ? "Ajouter un bulleur est conseillé, surtout la nuit, en période chaude ou si l’eau verdit."
        : "Ajouter un bulleur est indispensable et la charge en poissons doit être revue.";

  target.innerHTML = resultTemplate({
    value: score,
    title: `${format(score)} / 100`,
    level,
    text: recommendation,
    details: [
      `Renouvellement indicatif par la fontaine : ${round(turnover, 2)} fois le volume par heure.`,
      "Score indicatif : il ne mesure pas l’oxygène dissous réel.",
    ],
  });
}

function renderVolume(form, target) {
  const multipliers = { rectangle: 1, oval: 0.8, irregular: 0.65 };
  const volume =
    number(form, "length") *
    number(form, "width") *
    number(form, "depth") *
    (multipliers[choice(form, "shape")] || 1) *
    1000;
  const cubic = volume / 1000;
  const level = volume >= 2200 ? "ok" : volume >= 1400 ? "warn" : "risk";
  const text =
    volume >= 2200
      ? "Volume cohérent avec un petit bassin familial, à condition de rester prudent sur la population."
      : volume >= 1400
        ? "Volume modeste : garder une population légère et renforcer l’aération en été."
        : "Très petit volume : éviter les koï et limiter fortement les poissons.";

  target.innerHTML = resultTemplate({
    value: clamp((volume / 3000) * 100, 0, 100),
    title: `${format(volume)} L · ${round(cubic, 2)} m³`,
    level,
    text,
  });
}

function renderPump(form, target) {
  const volume = Math.max(number(form, "volume"), 1);
  const type = choice(form, "type");
  const watts = number(form, "watts");
  const price = number(form, "price");
  const hasFilter = choice(form, "filter") === "yes";
  const hasFountain = choice(form, "fountain") === "yes";
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

  target.innerHTML = resultTemplate({
    value: clamp((comfortFlow / 3000) * 100, 0, 100),
    title: `${format(minFlow)} à ${format(comfortFlow)} L/h`,
    level,
    text: `Débit conseillé pour un bassin ${rule.label}, avant pertes de charge dues aux tuyaux, hauteur de refoulement et filtre.`,
    details: [
      hasFountain
        ? "La fontaine améliore la surface, mais le débit utile de filtration peut être inférieur au débit annoncé."
        : "Sans fontaine, prévoir un brassage de surface ou un bulleur.",
      hasFilter
        ? "Filtration présente : viser surtout un débit régulier et des supports biologiques propres."
        : "Sans filtre, le résultat est fragile : ajouter une filtration biologique est prioritaire.",
      cost
        ? `Coût électrique annuel estimatif : environ ${round(cost, 0)} € si la pompe tourne 24 h/24.`
        : "Renseigner la puissance et le prix du kWh pour estimer le coût annuel.",
    ],
  });
}

function renderAir(form, target) {
  const volume = Math.max(number(form, "volume"), 1);
  const depth = number(form, "depth");
  const goldfish = number(form, "goldfish");
  const koi = number(form, "koi");
  const season = choice(form, "season");
  const temp = number(form, "temp");

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
  const seasonText =
    season === "hiver"
      ? "En hiver, garder une zone libre sans brasser violemment toute la profondeur si l’eau est très froide."
      : season === "été"
        ? "En été, aérer surtout la nuit et au petit matin, quand le risque de manque d’oxygène augmente."
        : "Aération régulière utile, à ajuster selon activité des poissons et météo.";

  target.innerHTML = resultTemplate({
    value: clamp((comfortable / 12) * 100, 0, 100),
    title: `${round(minimal, 1)} à ${round(comfortable, 1)} L/min`,
    level,
    text: `${diffusers} diffuseur${diffusers > 1 ? "s" : ""} suggéré${diffusers > 1 ? "s" : ""}, placé${diffusers > 1 ? "s" : ""} dans une zone profonde ou bien circulée.`,
    details: [seasonText],
  });
}

function renderPopulation(form, target) {
  const volume = Math.max(number(form, "volume"), 1);
  const goldfish = number(form, "goldfish");
  const koi = number(form, "koi");
  const size = number(form, "size");
  const filtration = choice(form, "filtration");
  const filterFactor =
    filtration === "strong" ? 1.2 : filtration === "correct" ? 1 : 0.68;
  const capacity = (volume / 1000) * 28 * filterFactor;
  const load =
    goldfish * Math.max(size, 8) * 0.55 + koi * Math.max(size, 15) * 3.8;
  const ratio = load / Math.max(capacity, 1);
  const score = clamp(ratio * 75, 0, 100);
  const level = ratio < 0.75 ? "ok" : ratio < 1.15 ? "warn" : "risk";
  const text =
    level === "ok"
      ? "Charge biologique estimée raisonnable, avec observation régulière et tests après changement."
      : level === "warn"
        ? "Charge sensible : renforcer filtration/aération et éviter toute nouvelle koï."
        : "Charge trop élevée pour une lecture prudente : retirer des poissons ou agrandir/renforcer fortement l’installation.";
  const actions = [];
  if (level !== "ok")
    actions.push(
      "Recommandé : renforcer l’aération, surveiller nitrites, réduire les rations.",
    );
  if (koi > 0)
    actions.push(
      "Avec koï : prévoir une solution à long terme si elle grandit.",
    );
  if (filtration === "weak")
    actions.push("Filtration faible : priorité au filtre biologique.");

  target.innerHTML = resultTemplate({
    value: score,
    title: `Charge ${round(ratio * 100, 0)} %`,
    level,
    text,
    details: actions,
  });
}

function renderFood(form, target) {
  const weight = number(form, "weight");
  const temp = number(form, "temp");
  let rate = 0;
  let level = "ok";
  let text =
    "Pas de nourriture ou seulement une quantité symbolique si les poissons sont actifs.";

  if (temp >= 8 && temp < 12) {
    rate = 0.003;
    text = "Ration légère, facile à digérer, avec observation attentive.";
  } else if (temp >= 12 && temp < 18) {
    rate = 0.006;
    text = "Alimentation modérée, à retirer si non consommée rapidement.";
  } else if (temp >= 18 && temp <= 25) {
    rate = 0.01;
    text = "Alimentation normale en petites prises, sans excès.";
  } else if (temp > 25) {
    rate = 0.005;
    level = "warn";
    text = "Eau chaude : petites quantités, forte vigilance oxygène.";
  }

  const grams = weight * rate;
  target.innerHTML = resultTemplate({
    value: clamp((grams / Math.max(weight * 0.01, 1)) * 70, 0, 100),
    title: `${round(grams, 1)} g/jour`,
    level,
    text,
    details: [
      "Tout doit être consommé en quelques minutes. En cas de nitrites ou poissons en surface, réduire ou arrêter.",
    ],
  });
}

function renderWater(form, target) {
  const temp = number(form, "temp");
  const ph = number(form, "ph");
  const kh = number(form, "kh");
  const ammonia = number(form, "ammonia");
  const nitrite = number(form, "nitrite");
  const nitrate = number(form, "nitrate");
  const messages = [];
  let risk = 0;

  if (temp > 25) {
    risk += 18;
    messages.push(
      "Température élevée : renforcer l’aération et fractionner la nourriture.",
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
      "Ammoniaque/ammonium détecté : réduire nourriture, tester à nouveau, vérifier filtre.",
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
  if (!messages.length)
    messages.push(
      "Lecture globalement rassurante, à confirmer par la stabilité dans le temps.",
    );

  const level = risk < 20 ? "ok" : risk < 48 ? "warn" : "risk";
  target.innerHTML = resultTemplate({
    value: clamp(risk, 0, 100),
    title:
      level === "ok"
        ? "Lecture stable"
        : level === "warn"
          ? "À surveiller"
          : "Action rapide",
    level,
    text: messages[0],
    details: messages.slice(1),
  });
}

const calculators = {
  fountain: renderFountain,
  volume: renderVolume,
  pump: renderPump,
  air: renderAir,
  population: renderPopulation,
  food: renderFood,
  water: renderWater,
};

const seasons = [
  [
    "Printemps",
    "Redémarrer filtration, tester les nitrites et reprendre la nourriture progressivement.",
  ],
  [
    "Été",
    "Oxygénation maximale, ombrage partiel, attention algues, évaporation et orages.",
  ],
  [
    "Automne",
    "Retirer les feuilles, réduire la nourriture et éviter l’accumulation de matières organiques.",
  ],
  [
    "Hiver",
    "Ne pas casser brutalement la glace, garder une zone libre et surveiller fontaine/pompe en cas de gel.",
  ],
];

const plants = [
  {
    title: "Nénuphars",
    text: "Ombre, refuge visuel et limitation de l’échauffement de surface.",
    svg: `<svg class="plant-icon" viewBox="0 0 260 140" aria-hidden="true"><ellipse cx="92" cy="74" rx="54" ry="22"/><ellipse cx="158" cy="82" rx="50" ry="20"/><path d="M124 96 C114 112 108 120 96 129"/><circle cx="134" cy="60" r="14" fill="#f4c86a"/></svg>`,
  },
  {
    title: "Plantes oxygénantes",
    text: "Aident l’équilibre et concurrencent les algues, sans remplacer un bulleur.",
    svg: `<svg class="plant-icon" viewBox="0 0 260 140" aria-hidden="true"><path d="M92 126 C90 86 98 58 122 24"/><path d="M126 126 C125 82 139 54 166 26"/><path d="M158 126 C164 86 184 62 212 42"/><ellipse cx="118" cy="43" rx="22" ry="8"/><ellipse cx="160" cy="49" rx="25" ry="8"/><ellipse cx="205" cy="58" rx="25" ry="8"/></svg>`,
  },
  {
    title: "Berges filtrantes",
    text: "Iris, joncs et plantes de berge captent une partie des nutriments.",
    svg: `<svg class="plant-icon" viewBox="0 0 260 140" aria-hidden="true"><path d="M80 126 C84 82 79 48 70 16"/><path d="M120 126 C121 76 134 44 150 16"/><path d="M170 126 C166 84 184 54 214 24"/><ellipse cx="70" cy="18" rx="8" ry="22"/><ellipse cx="150" cy="20" rx="8" ry="22"/><ellipse cx="212" cy="28" rx="8" ry="22"/></svg>`,
  },
];

const problems = [
  [
    "Poissons en surface",
    "Manque d’oxygène, nitrites, chaleur, surpopulation.",
    "Élevée",
    "Ajouter aération, arrêter nourriture, vérifier pompe.",
    "Réduire charge, renforcer filtre et bulleur.",
  ],
  [
    "Eau verte",
    "Algues en suspension, soleil, nitrates, filtre jeune.",
    "Moyenne",
    "Limiter nourriture, vérifier UV/filtration, ombrer.",
    "Plantes, filtration biologique, population prudente.",
  ],
  [
    "Eau trouble",
    "Particules, bactéries, remuage du fond, excès nourriture.",
    "Moyenne",
    "Contrôler filtre, retirer déchets visibles.",
    "Améliorer préfiltration et éviter suralimentation.",
  ],
  [
    "Algues filamenteuses",
    "Lumière, nutriments, faible concurrence végétale.",
    "Faible à moyenne",
    "Retirer manuellement sans tout décaper.",
    "Ombrage, plantes, réduction nitrates.",
  ],
  [
    "Mousse",
    "Protéines dissoutes, agitation, déchets organiques.",
    "Moyenne",
    "Écumer, réduire nourriture, vérifier odeur.",
    "Entretien filtre et charge biologique plus faible.",
  ],
  [
    "Odeur",
    "Décomposition, zone morte, vase excessive.",
    "Élevée",
    "Aérer, retirer matières en décomposition.",
    "Circulation, entretien doux du fond, filtration adaptée.",
  ],
  [
    "Poissons apathiques",
    "Température, nitrites, parasites, manque d’oxygène.",
    "Élevée",
    "Tester eau, augmenter aération, observer respiration.",
    "Stabilité, quarantaine des nouveaux poissons.",
  ],
  [
    "Fontaine qui gèle",
    "Gel nocturne, faible débit, tuyau exposé.",
    "Moyenne",
    "Sécuriser pompe, garder une zone libre.",
    "Prévoir mode hiver et protection tuyaux.",
  ],
  [
    "Pompe encrassée",
    "Feuilles, vase, préfiltre saturé.",
    "Moyenne",
    "Nettoyer préfiltre sans stériliser le média bio.",
    "Panier de protection et entretien régulier.",
  ],
];

function renderStaticContent() {
  const seasonCards = document.querySelector("#seasonCards");
  if (seasonCards) {
    seasonCards.innerHTML = seasons
      .map(
        ([title, text]) =>
          `<article class="info-card"><h4>${title}</h4><p>${text}</p></article>`,
      )
      .join("");
  }

  const plantCards = document.querySelector("#plantCards");
  if (plantCards) {
    plantCards.innerHTML = plants
      .map(
        (plant) =>
          `<article class="info-card">${plant.svg}<h4>${plant.title}</h4><p>${plant.text}</p></article>`,
      )
      .join("");
  }

  const accordion = document.querySelector("#problemAccordion");
  if (accordion) {
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
}

function bindCalculators() {
  document.querySelectorAll("form[data-calculator]").forEach((form) => {
    const type = form.dataset.calculator;
    const target = document.querySelector(`[data-result="${type}"]`);
    const render = calculators[type];
    if (!target || !render) return;

    const update = () => render(form, target);
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
  const saved = localStorage.getItem("pond-theme");
  if (saved === "light") root.classList.add("light");

  document.querySelector(".theme-toggle")?.addEventListener("click", () => {
    root.classList.toggle("light");
    localStorage.setItem(
      "pond-theme",
      root.classList.contains("light") ? "light" : "dark",
    );
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderStaticContent();
  bindCalculators();
  bindTheme();
});
