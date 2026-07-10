export interface MockEmail {
  id: string;
  title: string;
  subject: string;
  sender: string;
  type: "normal" | "emergency" | "noise";
  body: string;
}

export const mockEmails: MockEmail[] = [
  {
    id: "email-1",
    title: "📈 Rapport Mensuel Robeco (Premium Equities)",
    subject: "Robeco Global Premium Equities - Rapport Mensuel Juin 2026",
    sender: "sales-team@robeco.fr",
    type: "normal",
    body: `Cher partenaire,

Veuillez trouver ci-joint notre point mensuel sur le fonds Robeco Global Premium Equities en date du 2026-06-30.

Faits Marquants & Vues de Gestion :
- La performance mensuelle s'établit à +2.10% pour le mois de juin, portée par notre sélection de titres industriels.
- Les actifs sous gestion du fonds (AUM) atteignent désormais 1490 Millions d'euros, reflétant des flux entrants résilients.
- Nous avons accru notre niveau de liquidité tactique. Le taux de cash s'établit actuellement à 5.5% du portefeuille (comparé à 4.8% le mois précédent). Nous voulons garder des munitions de côté.

Positionnement Tactique :
- Nous maintenons notre surpondération sur l'Europe Value, notamment dans les secteurs des banques et de la santé défensive.
- Nous restons prudents sur les méga-caps technologiques américaines où la surchauffe de valorisation s'accélère. Nous sous-pondérons la technologie générale US, tout en rachetant quelques logiciels de manière très sélective (GARP).
- Sortie totale du secteur des matériaux de base ce mois-ci.

N'hésitez pas à nous contacter si vous avez des questions.

Bien cordialement,
L'équipe commerciale Robeco France`
  },
  {
    id: "email-2",
    title: "🚨 Alerte d'Urgence Amundi (Changement Équipe)",
    subject: "URGENT : Changement majeur d'équipe de gestion sur Amundi Horizon Global",
    sender: "contact@amundi.com",
    type: "emergency",
    body: `Message important destiné aux investisseurs professionnels.

Nous vous informons par la présente d'un changement de gouvernance sur le fonds Amundi Horizon Global Equity.

L'analyste de renom et gérant principal historique Jean-Marc Dupuis a pris la décision de quitter notre groupe pour poursuivre de nouveaux défis personnels. Ce départ prendra effet d'ici la fin du mois en cours.

Une structure de co-gérance temporaire menée par nos spécialistes seniors a été immédiatement déployée pour assurer la continuité opérationnelle. En conséquence directe de cette transition :
- Nous réduisons drastiquement la prise de risque.
- Le taux de cash est réduit au minimum de 1.8% pour solder les positions complexes, et nous augmentons le focus défensif sur les grandes capitalisations américaines à forte liquidité.
- La performance mensuelle a subi un contrecoup à -3.4% lié aux mouvements de réallocation technique. L'AUM s'élève à 3050 Millions EUR.

Nous reviendrons vers vous rapidement pour planifier un appel d'explication.

L'équipe d'Amundi Asset Management`
  },
  {
    id: "email-3",
    title: "🌊 Nouveau Fonds Robeco (Sustainable Water - Unknown)",
    subject: "Lancement & Update : Robeco Sustainable Water - Juillet 2026",
    sender: "sales-team@robeco.nl",
    type: "normal",
    body: `Dear Investment Analyst,

We are pleased to send you the latest portfolio manager comments for the Robeco Sustainable Water fund for the period ending 2026-07-05.

Core Portfolio update:
- Performance for the month was solid at +1.45%, driven by water infrastructure and sewage treatment tech leaders in Europe.
- The Fund Assets (AUM) have grown to 1520 Million EUR as demand for sustainability water themes accelerates.
- The cash rate has been optimized at 4.90% to maintain a steady deployment rate into small-to-mid-cap clean water pure-players.

Portfolio Positioning:
- Highly overweight in water treatment equipment providers and digital water grid infrastructure.
- Neutral position in regulated water utilities due to regulatory headwinds in southern Europe.
- Zero exposure to intensive chemical water treatment operations.

As this is a new thématique in our coverage, please share this with your lead sector analyst.

Best regards,
Robeco Global Sales Team`
  },
  {
    id: "email-4",
    title: "⚠️ Bruit / Publicité (Invitation Webinaire à filtrer)",
    subject: "Invitation Webinaire : Perspectives de marché Q3 par Amundi Sales Expert",
    sender: "webinar@amundi-event.com",
    type: "noise",
    body: `Bonjour,

Participez à notre webinaire exclusif en direct le jeudi 24 juillet à 15h00 CET !

Notre expert en macroéconomie et notre direction commerciale France viendront partager leurs convictions de marché globales pour le troisième trimestre.

Au programme :
- Analyse géopolitique des tensions commerciales.
- Présentation générale de nos solutions d'épargne estivales pour vos clients.
- Session de questions-réponses de 15 minutes.

Inscrivez-vous dès aujourd'hui en cliquant sur le lien ci-dessous. Les places sont limitées !

[S'inscrire au Webinaire]

L'équipe Amundi Event`
  }
];
