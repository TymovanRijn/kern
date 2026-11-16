/* =========================================================
   Kern · Dagboek
   Elke ochtend vink je aan wat je de dag ervoor deed. Na genoeg antwoorden
   vergelijkt de app je HRV en rusthartslag op de ochtend ná een "ja"
   met de ochtend ná een "nee".

   De gedragslijst volgt de openbare lijst van het WHOOP-dagboek (support.whoop.com,
   "WHOOP Journal Overview"), vertaald naar het Nederlands. Merkgebonden items zijn
   weggelaten; gedragingen die WHOOP als schaal vraagt, zijn hier ja/nee.
   Ontgrendelregel zoals bij WHOOP: minstens 5× ja en 5× nee binnen 90 dagen.
   ========================================================= */
(function(){
const CATALOG=[
 ['Middelen en medicatie',[
  ['adhd_med','AD(H)D-medicatie'],['anxiety_med','Medicatie tegen angst'],['nsaid','Ontstekingsremmer (bijv. ibuprofen)'],['bp_med','Bloeddrukmedicatie'],
  ['chemo','Chemotherapie'],['covid_boost','Coronavaccinatie (booster)'],['covid_1','Coronavaccinatie (dosis 1)'],['covid_2','Coronavaccinatie (dosis 2)'],
  ['glp1','GLP-1'],['ketamine','Ketamine'],['lsd','LSD'],['marijuana','Cannabis'],['nicotine','Nicotine'],['pain_med','Pijnstillers op recept'],
  ['sleep_med','Slaapmiddelen op recept'],['psilocybin','Psilocybine'],['radiation','Bestraling'],['tobacco','Tabak'],['weightloss_med','Afslankmedicatie'],['allergy_med','Allergiemedicatie']]],
 ['Gezondheid en klachten',[
  ['acne','Acne'],['back_pain','Rugpijn'],['bloating','Opgeblazen gevoel'],['brain_fog','Brainfog'],['constipation','Verstopping'],['covid_sympt','Coronaklachten'],
  ['dizzy','Duizelig of licht in je hoofd'],['energy','Goed energieniveau'],['fatigue','Vermoeidheid'],['fever','Koorts'],['cravings','Trek in eten (cravings)'],['forgetful','Vergeetachtigheid'],
  ['gas','Winderigheid'],['hair_loss','Haaruitval of dunner haar'],['headache','Hoofdpijn'],['heartburn','Brandend maagzuur'],['palpitations','Hartkloppingen'],['hotflash_sleep','Opvliegers tijdens de slaap'],
  ['hotflash_day','Opvliegers overdag'],['injury','Blessure'],['joint_pain','Gewrichtspijn of stijfheid'],['migraine','Migraine'],['mpox','Mpox-klachten'],['aches','Spier- of lichaamspijn'],
  ['night_sweats','Nachtzweten'],['hayfever','Seizoensallergie'],['sick','Ziek'],['skin','Huidveranderingen'],['temp_sens','Gevoelig voor temperatuur'],['tingling','Tintelingen of gevoelloosheid'],
  ['vomit','Overgeven'],['nightmare','Nachtmerrie']]],
 ['Hormonale gezondheid',[
  ['antiandrogen','Anti-androgeen'],['bodyodor','Veranderde lichaamsgeur'],['breast_growth','Borstgroei'],['breast_tender','Gevoelige borsten'],['clonidine','Clonidine'],['conception','Bevruchting'],
  ['cycle_irreg','Onregelmatige cyclus'],['dhea','DHEA'],['libido_down','Minder zin in seks'],['estrogen','Oestrogeen'],['gabapentin','Gabapentine'],['hrt','Hormoontherapie (HRT)'],
  ['libido_up','Meer zin in seks'],['lh_test','LH-test (ovulatietest)'],['cramps','Menstruatiekrampen'],['menstruation','Menstruatie'],['moodswings','Stemmingswisselingen'],['ovulation','Eisprong'],
  ['pain_sex','Pijn bij seks'],['pelvic','Bekkenpijn'],['perimenopause','Perimenopauze'],['postmenopause','Postmenopauze'],['pregnancy','Zwangerschap'],['progesterone','Progesteron'],
  ['prog_cream','Progesteroncrème'],['pumping','Kolven'],['sleep_decline','Slechter slapen'],['testo_gel','Testosterongel of -crème'],['testo_supp','Testosteronsupplementen'],['thyroid','Schildkliermedicatie'],
  ['urinary','Plasklachten'],['discharge_creamy','Afscheiding: romig'],['discharge_eggwhite','Afscheiding: als eiwit'],['discharge_grey','Afscheiding: grijs'],['discharge_sticky','Afscheiding: plakkerig'],
  ['vag_dry','Vaginale droogheid'],['vag_est_cream','Vaginale oestrogeencrème'],['vag_est_ring','Vaginale oestrogeenring'],['vag_est_tab','Vaginale oestrogeentabletten'],['spotting','Tussentijds bloedverlies']]],
 ['Leefstijl',[
  ['air_travel','Vliegreis'],['alcohol','Alcohol'],['caffeine','Cafeïne'],['caregiving','Mantelzorg'],['family_friends','Tijd met familie en vrienden'],['night_feed','Baby ’s nachts voeden'],
  ['int_fasting','Intermittent fasting'],['jetlag','Jetlag'],['masturbation','Masturbatie'],['night_shift','Nachtdienst'],['nursing','Verzorgen'],['nursing_infant','Borstvoeding geven'],
  ['oncall','Bereikbaarheidsdienst'],['outdoor','Tijd buiten'],['parenting','Ouderschap'],['sick_child','Ziek kind verzorgen'],['ramadan','Ramadan'],['relationship','Tijd met je partner'],
  ['remote','Thuiswerken'],['sex','Seks'],['shared_child','Slaapkamer gedeeld met kind'],['vacation','Vakantie'],['work_calls','Werkgesprekken of -calls'],['commute','Woon-werkreis'],
  ['work_late','Laat doorgewerkt'],['standing','Stabureau']]],
 ['Mentaal welzijn',[
  ['anxiety','Angst of onrust'],['challenge','Uitdaging gevoeld'],['control','Gevoel van controle'],['depression','Somber of depressief'],['efficacy','Gevoel dat je het kunt'],['mental_state','Goede mentale toestand'],
  ['gratitude','Dankbaarheid'],['irritability','Prikkelbaar'],['journaling','Dagboek geschreven'],['learning','Iets geleerd'],['progress','Vooruitgang geboekt'],['motivation','Gemotiveerd'],
  ['positivity','Positief'],['purpose','Gevoel van zingeving'],['social_fulfilled','Sociaal voldaan'],['spirituality','Spiritualiteit'],['stress','Stress'],['therapy','Therapiesessie'],
  ['threat','Gevoel van dreiging'],['socially_drained','Sociaal uitgeput'],['solo','Tijd voor jezelf']]],
 ['Voeding',[
  ['sugar','Toegevoegde suiker'],['calcium','Genoeg calcium'],['calories','Genoeg calorieën'],['carbs','Veel koolhydraten'],['clean','Gezond en onbewerkt gegeten'],['dairy','Zuivel'],
  ['dairy_free','Zuivelvrij gegeten'],['fats','Veel vet'],['fiber','Genoeg vezels'],['fruit_veg','Groente en fruit'],['gluten_free','Glutenvrij gegeten'],['hydration','Genoeg gedronken (water)'],
  ['keto','Ketogeen dieet'],['kosher','Koosjer dieet'],['magnesium','Magnesiumrijk gegeten'],['meat','Vlees'],['paleo','Paleodieet'],['protein','Genoeg eiwit'],
  ['snacking','Tussendoortjes'],['sodium','Veel zout'],['vegan','Veganistisch gegeten'],['vegetarian','Vegetarisch gegeten'],['lunch','Lunch'],['dinner','Avondeten'],
  ['breakfast','Ontbijt'],['snack_am','Tussendoortje in de ochtend'],['snack_pm','Tussendoortje in de middag'],['snack_eve','Tussendoortje in de avond'],['plant_protein','Plantaardig eiwit'],['restaurant','Uit eten'],
  ['homecooked','Zelf gekookt'],['takeout','Afhaal of bezorging'],['herbal_tea','Kruidenthee'],['postmeal_walk','Wandeling na het eten'],['poultry','Kip of gevogelte'],['beans','Bonen'],
  ['tofu','Tofu'],['nuts','Noten'],['pre_workout_meal','Gegeten vóór de training']]],
 ['Herstel',[
  ['acupuncture','Acupunctuur'],['breathwork','Ademhalingsoefeningen'],['chiro','Chiropractor'],['cold_shower','Koude douche'],['compression','Compressie'],['cryo','Cryotherapie'],
  ['cupping','Cupping'],['hottub','Bubbelbad'],['hyperbaric','Hyperbare kamer'],['icebath','IJsbad'],['massage','Massage'],['meditation','Meditatie'],
  ['physio','Fysiotherapie'],['recovery_day','Hersteldag'],['redlight','Roodlichttherapie'],['sauna','Sauna'],['float','Floaten'],['steam','Stoomcabine'],
  ['stretching','Stretchen'],['zone2','Zone 2-cardio'],['warm_bath','Warm bad'],['vagus','Nervus vagus-stimulatie']]],
 ['Slaap en ritme',[
  ['artificial_light','Kunstlicht ’s avonds'],['bluelight','Blauwlichtfilterbril'],['cpap','CPAP-apparaat'],['cat','Kat in de slaapkamer'],['daylight_eating','Alleen overdag gegeten'],['device_bed','Telefoon of scherm in bed'],
  ['dim','Gedimd licht ’s avonds'],['dog','Hond in de slaapkamer'],['earplugs','Oordopjes'],['hot_shower','Warme douche voor het slapen'],['humidifier','Luchtbevochtiger'],['late_meal','Laat gegeten'],
  ['morning_sun','Ochtendzonlicht'],['mouth_tape','Mondtape'],['mouthguard','Bitje'],['nasal_strip','Neusstrip'],['read_bed','Gelezen in bed'],['shared_bed','Bed gedeeld'],
  ['sleep_mask','Slaapmasker'],['dark_room','In een donkere kamer geslapen'],['own_bed','In je eigen bed geslapen'],['sound_machine','Witte ruis of geluidsmachine'],['sunset','Zonsondergang gezien'],['weighted_blanket','Verzwaringsdeken'],
  ['snoring_partner','Snurkende partner']]],
 ['Supplementen',[
  ['cbd','CBD'],['calcium_supp','Calciumsupplement'],['creatine','Creatine'],['electrolytes','Elektrolyten'],['fish_oil','Visolie'],['magnesium_supp','Magnesiumsupplement'],
  ['melatonin','Melatonine'],['multivit','Multivitamine'],['postnatal','Postnatale vitamines'],['prenatal','Prenatale vitamines'],['probiotic','Probiotica'],['turmeric','Kurkuma'],
  ['b12','Vitamine B12'],['vit_c','Vitamine C'],['vit_d','Vitamine D'],['zinc','Zink'],['ashwagandha','Ashwagandha'],['omega3','Omega 3-supplement']]]
];
const LABEL={};for(const[,items]of CATALOG)for(const[id,l]of items)LABEL[id]=l;
const DEFAULT=['alcohol','caffeine','late_meal','device_bed','stress','read_bed','morning_sun','hydration'];
const label=id=>LABEL[id]||id;

const DAY=864e5,mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const varr=a=>{const m=mean(a);return a.reduce((x,y)=>x+(y-m)*(y-m),0)/(a.length-1)};
const dk=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const next=k=>{const d=new Date(k+'T00:00');d.setDate(d.getDate()+1);return dk(d)};
function welch(a,b){if(a.length<2||b.length<2)return 0;const se=Math.sqrt(varr(a)/a.length+varr(b)/b.length);return se>0?(mean(a)-mean(b))/se:0}

/* Vergelijkt per gedraging de ochtend na "ja" met de ochtend na "nee".
   journal: {dag: {id: 1|0}} · days: {dag: {hrv, rhr, ...}} · use(meting): telt deze meting mee (zelfde ademtempo)
   Herstel = hogere HRV en lagere rusthartslag; beide gaan als t-waarde mee, gemiddeld. */
function analyse(journal,days,ids,use,today=new Date()){const cut=dk(new Date(+today-90*DAY));const out=[];
  for(const id of ids){const yes={hrv:[],rhr:[]},no={hrv:[],rhr:[]};let ny=0,nn=0;
    for(const[k,ans]of Object.entries(journal)){if(k<cut||!(id in ans))continue;const m=days[next(k)];if(!m||!use(m))continue;
      const g=ans[id]?yes:no;if(ans[id])ny++;else nn++;if(m.hrv>0)g.hrv.push(Math.log(m.hrv));if(m.rhr>0)g.rhr.push(m.rhr)}
    const r={id,label:label(id),ny,nn,unlocked:ny>=5&&nn>=5};
    if(r.unlocked&&yes.hrv.length>=2&&no.hrv.length>=2){r.hrvPct=(Math.exp(mean(yes.hrv)-mean(no.hrv))-1)*100;r.tHrv=welch(yes.hrv,no.hrv);
      r.hrvYes=Math.exp(mean(yes.hrv));r.hrvNo=Math.exp(mean(no.hrv))}
    if(r.unlocked&&yes.rhr.length>=2&&no.rhr.length>=2){r.rhrDiff=mean(yes.rhr)-mean(no.rhr);r.tRhr=welch(yes.rhr,no.rhr);r.rhrYes=mean(yes.rhr);r.rhrNo=mean(no.rhr)}
    if(r.unlocked){const ts=[];if(r.tHrv!=null)ts.push(r.tHrv);if(r.tRhr!=null)ts.push(-r.tRhr);r.t=ts.length?mean(ts):0;
      const a=Math.abs(r.t);r.level=a>=2.5?'duidelijk':a>=1.5?'matig':'verwaarloosbaar';r.dir=r.t>=0?1:-1}
    out.push(r)}
  return out.sort((a,b)=>(b.unlocked-a.unlocked)||Math.abs(b.t||0)-Math.abs(a.t||0))}

/* Twee gedragingen die vrijwel altijd samen voorkomen, zijn niet uit elkaar te halen (zoals WHOOP ook waarschuwt). */
function overlaps(journal,ids){const res=[];
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){let same=0,n=0,anyYes=0;
    for(const ans of Object.values(journal)){if(!(ids[i]in ans)||!(ids[j]in ans))continue;n++;if(!!ans[ids[i]]===!!ans[ids[j]])same++;if(ans[ids[i]]||ans[ids[j]])anyYes++}
    if(n>=10&&anyYes>=5&&same/n>=.9)res.push([ids[i],ids[j],Math.round(same/n*100)])}
  return res}

window.J={CATALOG,DEFAULT,label,analyse,overlaps,next};
})();
