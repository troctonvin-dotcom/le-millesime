// Contenu par défaut du site. Le tableau de bord enregistre ses modifications dans la base
// (table « contenu », id « site ») ; ce qui n'y est pas encore reprend les valeurs ci-dessous.
module.exports = {
  infos: {
    nom: "Le Millésime",
    telephone: "06 70 10 94 54",
    email: "contact.nrdiffusion@gmail.com",
    adresse: "8 Avenue Georges Pompidou",
    code_postal: "89100",
    ville: "Sens",
    instagram: "le_millesime_sens",
    note_google: "4,7",
    nombre_avis: "31",
    horaires: [
      { jour: "Lundi", ouvert: false, ouverture: "", fermeture: "" },
      { jour: "Mardi", ouvert: true, ouverture: "11:00", fermeture: "22:00" },
      { jour: "Mercredi", ouvert: true, ouverture: "11:00", fermeture: "22:00" },
      { jour: "Jeudi", ouvert: true, ouverture: "11:00", fermeture: "01:00" },
      { jour: "Vendredi", ouvert: true, ouverture: "11:00", fermeture: "01:00" },
      { jour: "Samedi", ouvert: true, ouverture: "11:00", fermeture: "01:00" },
      { jour: "Dimanche", ouvert: false, ouverture: "", fermeture: "" }
    ]
  },
  annonce: { actif: false, texte: "", lien: "" },
  accueil: {
    surtitre: "Cave & bar à vin · Sens (Yonne)",
    titre: "Le Millésime",
    accroche: "Un verre de vin, une planche généreuse, et le temps de ne penser à rien d'autre.",
    slogan: "Jusqu'à la dernière goutte.",
    photo: "assets/img/hero-medaillon-cave.jpg",
    photo_alt: "Coin dégustation avec tonneaux et rayonnages de la cave à vin Le Millésime à Sens"
  },
  histoire: {
    titre: "Notre histoire",
    texte: "Derrière Le Millésime, une famille de commerçants installée à Sens depuis 1960, dans le commerce de bouche. En 2024, nous avons repris l'activité de négoce familiale pour lui donner une nouvelle vie, et nous avons ouvert nos portes le 29 novembre 2025.\n\nIci, on vient pour partager : une planche de fromages, foie gras ou charcuterie, des produits fins choisis chez nos artisans partenaires, et bien sûr le vin. Un lieu dédié aux passionnés, où l'on vient découvrir, savourer et trinquer sans façon.",
    photo: "assets/img/histoire.jpg",
    photo_alt: "Le fondateur du Millésime, dans sa cave entourée de grands crus"
  },
  offre: {
    titre: "Ce qu'on propose",
    intro: "Une cave à vin, un bar à vin et une épicerie fine réunis sous un même toit, au cœur de Sens.",
    cartes: [
      { titre: "La Cave", texte: "Plus de 600 références pour tous les goûts et tous les budgets : des découvertes du quotidien aux grands crus et vins sur allocation, accessibles à tous.", photo: "assets/img/gallery-cave.jpg", photo_alt: "Rayonnages de la cave à vin du Millésime à Sens" },
      { titre: "Le Bar à Vin", texte: "Vins au verre, spiritueux et bières locales, à savourer sur place autour d'une bonne planche.", photo: "assets/img/gallery-degustation.jpg", photo_alt: "Coin dégustation du bar à vin Le Millésime" },
      { titre: "L'Épicerie Fine", texte: "Des produits locaux à emporter, pour prolonger la dégustation à la maison.", photo: "assets/img/gallery-truffe.jpg", photo_alt: "Planche de fromage à la truffe de l'épicerie fine du Millésime" }
    ]
  },
  avis: {
    titre: "Avis",
    liste: [
      { nom: "Sabrina", date: "décembre 2025", texte: "Un superbe endroit ! Le cadre est chaleureux et très élégant, avec une magnifique sélection de bouteilles. L'accueil est vraiment top, on se sent tout de suite à l'aise. Une très belle découverte, je recommande vivement !" },
      { nom: "Quentin", date: "avril 2026", texte: "J'ai donné carte blanche pour fêter les 3 ans avec ma copine : chose faite. Des planches apéritif de toutes sortes, choix de vins épuré mais suffisant. Des surprises de leur part pour marquer le coup. Agréablement surpris et content de la prestation. Encore merci." },
      { nom: "Ophélie", date: "février 2026", texte: "Excellente expérience ! Je vous recommande ce lieu pour des moments de convivialité, et Nathan est de très bon conseil !" },
      { nom: "Prestige VTC", date: "décembre 2025", texte: "Petite dégustation de vin hier. L'endroit est propre et chaleureux. Le personnel est présent pour donner des conseils, très appréciable. On recommande cet établissement." }
    ]
  },
  evenements: {
    titre: "Privatisez Le Millésime",
    texte: "Anniversaire, mariage, baptême, séminaire ou soirée d'entreprise : Le Millésime se prête à toutes les occasions qui méritent d'être célébrées autour d'un bon verre. Nous composons avec vous une sélection de vins et une formule adaptée à votre événement.",
    etiquettes: ["Anniversaire", "Mariage", "Baptême", "Séminaire", "Soirée d'entreprise"],
    photo: "assets/img/evenements.jpg",
    photo_alt: "Soirée organisée sur la terrasse du Millésime, DJ, planches et invités réunis au coucher du soleil"
  },
  negoce: {
    titre: "Espace Négoce",
    texte: "Le Millésime accompagne les professionnels des secteurs 45, 89 et 10 (Loiret, Yonne et Loir-et-Cher). Restaurants, hôtels, cavistes et entreprises : nous construisons avec vous une sélection adaptée à vos besoins et à vos clients.",
    etiquettes: ["Agent commercial Maison Boisset", "Allocataires Grands Domaines de Bourgogne", "DRC · Ramonet · Jean-Louis Chave Hermitage", "Bordeaux : Cheval Blanc & Petrus"],
    texte2: "Un accès privilégié aux vins les plus recherchés : grands crus de Bourgogne en allocation, Bordeaux d'exception (Cheval Blanc, Petrus) et les cuvées Jean-Louis Chave, des bouteilles que l'on ne trouve pas en grande distribution.",
    photo: "assets/img/gallery-bordeaux.jpg",
    photo_alt: "Grands crus de Bordeaux, dont Château Cheval Blanc, dans la cave du Millésime"
  },
  faq: [
    { question: "Où trouver une cave à vin à Sens ?", reponse: "Le Millésime est une cave à vin et un bar à vin situé 8 Avenue Georges Pompidou, 89100 Sens. On y trouve plus de 600 références, des vins du quotidien aux grands crus de Bourgogne et de Bordeaux, avec les conseils d'un sommelier." },
    { question: "Peut-on boire un verre de vin sur place ?", reponse: "Oui. Le bar à vin sert des vins au verre, des spiritueux et des bières locales, à accompagner de planches de fromages, de charcuterie ou de foie gras, en salle ou en terrasse." },
    { question: "Quels sont vos horaires ?", reponse: "Du mardi au samedi de 11h à 22h, et jusqu'à 1h du matin les jeudis, vendredis et samedis soir. Fermé le dimanche et le lundi." },
    { question: "Peut-on privatiser Le Millésime ?", reponse: "Oui, pour un anniversaire, un mariage, un baptême, un séminaire ou une soirée d'entreprise. Nous composons avec vous une sélection de vins et une formule adaptée." },
    { question: "Travaillez-vous avec les professionnels ?", reponse: "Oui. L'Espace Négoce accompagne restaurants, hôtels, cavistes et entreprises avec une sélection sur mesure et un accès à des vins rares : grands crus de Bourgogne en allocation, Bordeaux d'exception et cuvées Jean-Louis Chave." },
    { question: "Comment réserver une table ?", reponse: "Par le formulaire de réservation du site, par téléphone au 06 70 10 94 54 ou par message sur Instagram (@le_millesime_sens)." }
  ],
  galerie: {
    intro: "La cave, le bar, la terrasse, les planches et les soirées du Millésime, en images.",
    photos: [
      { src: "assets/img/gallery-terrasse.jpg", alt: "La terrasse du Millésime à Sens au coucher du soleil, fauteuils colorés et tonneaux de vin", format: "large" },
      { src: "assets/img/gallery-cave.jpg", alt: "Vue d'ensemble des rayonnages de la cave à vin, remplis de vins soigneusement sélectionnés", format: "haute" },
      { src: "assets/img/gallery-salon.jpg", alt: "Salon convivial du bar à vin avec ses fauteuils et son mur de champagnes", format: "normale" },
      { src: "assets/img/gallery-bordeaux.jpg", alt: "Grands crus de Bordeaux, dont Château Cheval Blanc et Mouton Rothschild, sur les rayonnages", format: "large" },
      { src: "assets/img/gallery-bouteille-main.jpg", alt: "Un Saint-Amour Mommessin présenté à la main devant les rayonnages de la cave du Millésime", format: "haute" },
      { src: "assets/img/gallery-champagne.jpg", alt: "Coffret de champagne présenté en vitrine de la cave à vin Le Millésime à Sens", format: "normale" },
      { src: "assets/img/gallery-spiritueux.jpg", alt: "Sélection de spiritueux et liqueurs locales sur les étagères du bar à vin", format: "haute" },
      { src: "assets/img/gallery-truffe.jpg", alt: "Planche de fromage à la truffe fraîche, servie sur une assiette fine", format: "normale" },
      { src: "assets/img/gallery-degustation.jpg", alt: "Coin dégustation cosy avec fauteuils et verres à vin devant les étagères", format: "haute" },
      { src: "assets/img/gallery-dj.jpg", alt: "DJ animant une soirée au Millésime, bar à vin à Sens", format: "haute" },
      { src: "assets/img/gallery-ambiance.jpg", alt: "Ambiance chaleureuse de la cave, entre bouteilles de champagne et rosé de Provence", format: "normale" }
    ]
  },
  contact: {
    titre: "Réservation & Contact",
    intro: "Une table à réserver, un événement à organiser, une question ? Écrivez-nous, on vous répond rapidement."
  }
};
