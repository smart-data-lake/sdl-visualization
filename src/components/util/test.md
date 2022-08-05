
# Erweiterte Stammdaten zu den Fahrzeugen
Erweiterte Stammdaten des Fahrwerks geben die Werte der TPS-Einstufung 
der Fahrzeuge wieder. **Der Abzug von Fahrzeugebzogenen Stammdaten sollte vermieden werden **

|Column|Description|
|-----|-----|
|id_fahrtyp| ID des Fahrtyps |
|betriebsmodus| Betriebsmodus. Der Betriebsmodus beschreibt                         Eigenschaftsänderungen des Fahrzeugs ohne physische Änderung des Fahrzuegs.Änderung der Zugkraftkennlinie Adhäsions und Zahnstangenbetrieb oder bei Wechsel 16kV 162/3Hz auf 25kV,50Hz|
|fahrtyp|  Fahrtypname |
## Stammdaten zu Regeluntstechnik der Fahrzeuge
Es werden die Grundlagen der regelungstechnischen Eigenschaften 
der Fahrzeuge geführt. Dieser Block erfährt eine komplette Neugestaltung und soll zukünftig das Quellfile, 
eine Enschätzung der Güte,eine mögliche Quellreferenz und die Angabe ob es Ersatzwerte sind verwalten. 
|Column|Description|
|-----|-----|
|adhaes|DEPRECATED Die grosse Detailierung ist mit der Vorberechnung hinfällig |
|adhaes.default_v0_d_v| DEPRECATED|
|adhaes.dv_regler_kennl.[]| DEPRECATED|
|adhaes.dv_regler_kennl.[].v0| DEPRECATED|
|adhaes.dv_regler_kennl.[].d_v| DEPRECATED|
|adhaes.dv_regler_kennl_quelle| DEPRECATED|
|adhaes.kritische_kennl_neigung| DEPRECATED|
|adhaes.antr_steuertyp_txt| DEPRECATED|
|adhaes.antr_steuertyp_nr| DEPRECATED|
|adhaes.ctaw_knmrad| DEPRECATED|
|adhaes.jrad_kgm2| DEPRECATED|
|adhaes.amp_as| DEPRECATED|
|adhaes.amp_nas| DEPRECATED|
|adhaes.frollier_hz| DEPRECATED|
|adhaes.quellvermerke| DEPRECATED|
## Stammdaten zm Gesamtfahrzeug auf Achsebene 
|Column|Description|
|-----|-----|
|axs.[]| |
|axs.[].ax_nr|     Laufende Achsnummer im Fahrzeug |
|axs.[].dgtyp|     Typ des Drehgestells : LDG-Laufdrehgestell, TDG-Triebdrehgestell, J-LDG-Jakobslaufdrehgestell , ...|
|axs.[].fuehrend|  Achse ist führend |
|axs.[].steuertyp| Typ der Leistungsübertragung> 0: KommutatorMotor/Schaltwerk, 1 Drehstromantrieb Einzelachs, 2: Drehstrom Gruppenantrieb, 3: Diesel (Ströumgsgetrieb, Dieselelektr.|
|axs.[].antr_gr_no| Zuordnung zur Antriebsgruppe (Umrichter, Gelenkwelle) |
|axs.[].achsentl|   DEPRECATED Achsentlastungsfaktor (in Vorberechnung enthalten) |
|axs.[].q0_kn|  {kN} Radaufstandskraft |
|axs.[].mu_kg|  {kg} Unabgefederte Massen pro Radseite|
|axs.[].drad_m|  {m} Raddurchmesser|
|axs.[].prad_kw|{kW} Antriebsleistung pro Rad|
|axs.[].yw|     {kN} Führungskräfte in Weichen, Simulation eines R185 Wechselbogen |
|axs.[].angetrieben| Achse angetrieben oder Laufachse |
## Stammdaten der TPS-Einstufung der Fahrzeuge (Fahrwerke)
|Column|Description|
|-----|-----|
|fahrwerke.[]| |
|fahrwerke.[].dgtyp| Gibt an ob Lauf,Jakobs oder Triebdrehgestell|
|fahrwerke.[].n_ax| Anzahl der Achsen im Fahrwerk |
|fahrwerke.[].n_dg| Anzahl Fahrwerke im Fahrzeug |
|fahrwerke.[].q0_kn|   {kN} Radaufstandskraft |
|fahrwerke.[].mu_kg|   {kg} Ungefederte Masse pro Radseite|
|fahrwerke.[].drad_m|   {m} Raddurchmesser |
|fahrwerke.[].prad_kw| {kW} Antriebsleistung pro Rad|
## Stammdaten der Fahrzeuge, diskrete Einschätzung der Reibenergielasten des Fahrzeugs (ein führender Radsatz) 
|Column|Description|
|-----|-----|
|fahrwerke.[].lead_ax_wear_discret| |
|fahrwerke.[].lead_ax_wear_discret.wb_r600_1200| {J/m} Reibenergie im Bogenbereich R 600-1200m |
|fahrwerke.[].lead_ax_wear_discret.wb_r400_600| {J/m} Reibenergie im Bogenbereich R 400-600m |
|fahrwerke.[].lead_ax_wear_discret.wb_r300_400| {J/m} Reibenergie im Bogenbereich R 300-400m |
|fahrwerke.[].lead_ax_wear_discret.wb_r300| {J/m} Reibenergie im Bogenbereich R<300m|
|fahrwerke.[].lead_ax_wear_discret.yw| {kN} Führungskräfte in Weichen, Simulation eines R185 Wechselbogen |
|fahrwerke.[].lead_ax_ty_fit.wb_typ| Funktionstyp der Verwendung der Koeffzientena a,b in der Ermittlung der Reibenergie wb{J/m} abhänging vom Bogenradius abs(R) R in {m} [ConfluenceSeite zur HeadcheckPorgnose und Traktionsueberhoehung](https://confluence.sbb.ch/pages/viewpage.action?pageId=1524926686). l. l: linear      wb(1/R) = `a*(1/R) + b` 2. p: potenz      wb(1/R) = a*(1/R)^b 3. e: exponentiel wb(1/R) = a*e^((1/R)^b)|
|fahrwerke.[].lead_ax_ty_fit.wb_a| Koffizient a |
|fahrwerke.[].lead_ax_ty_fit.wb_b| Koffizient b|
|fahrwerke.[].smpck_model| |
|fahrwerke.[].smpck_model.interpol_fakt| {-} Faktor bei Verwendung von anderen Sim.Modellen in der Massenanpassung|
|fahrwerke.[].smpck_model.sim_q0_max| {kN} Maximale Radaufstandskraft im Simulationsmodel, Gegenvergleichszweck |
|fahrwerke.[].smpck_model.q0_quelle| Quellvermerke für Radaufstandskräfte |
|fahrwerke.[].smpck_model.mu_quelle| Quellvermerke für unabgefederte Massen |
|fahrwerke.[].smpck_model.schaetzung| Flag, im Falle keiner eigenen Simulation sondern Vererbung von anderen artverwandten Modellen|
|fahrwerke.[].smpck_model.smpck_file| Name des Modellfiles von Simpack |
|fahrwerke.[].smpck_model.bemerkungen| Bemerkungen, Freitext |
## Koeffizienten der Traktionsüberhoehung
Reibenergeien werden bogenabhängig durch Zugkrafteinfluss überhöht. Dazu müssen 
pro Fahrzeug im rollenden Zustand Zusatzsimulationen ausgeführt werden. 
Weil das in Menge und Zeit nicht ging werden auch Ergebnisse von anderen Fahrzeugen vererbt. 
Mit dem Neuaufsetzen in HC2.1 und einer geschlossenen Berechnung wird wb-Fit und 
Zugkraftüberhöhung hinfällig. Es kommen aus dem Programm TableCurve 3D nur Fitfunktionen zur Anwendung :
1. Eq303 : z=a+b/x+cy+d/x^2+ey^2+fy/x
2. Eq310 : z=a+bx+cy+dx^2+ey^2+fxy+gx^3+hy^3+ixy^2
mit x = abs(1/R) (Krümmung)  und y = Fsoll/F_anf (Sollzugkraftauschöpfung gegenüber Anfahrzugkraft) 

|Column|Description|
|-----|-----|
|fahrwerke.[].traction_effects_coeff| |
|fahrwerke.[].traction_effects_coeff.c_typ| Referenziert auf das Programm TableCurve 3D welche Fitfunktionsnummer verwendet wurde  (Eq303, Eq310)|
|fahrwerke.[].traction_effects_coeff.c_a| Koeffizient a|
|fahrwerke.[].traction_effects_coeff.c_b| Koeffizient b|
|fahrwerke.[].traction_effects_coeff.c_c| Koeffizient c|
|fahrwerke.[].traction_effects_coeff.c_d| Koeffizient d|
|fahrwerke.[].traction_effects_coeff.c_e| Koeffizient e|
|fahrwerke.[].traction_effects_coeff.c_f| Koeffizient f|
|fahrwerke.[].traction_effects_coeff.c_g| Koeffizient g|
|fahrwerke.[].traction_effects_coeff.c_h| Koeffizient h|
|fahrwerke.[].traction_effects_coeff.c_i| Koeffizient i |
|fahrwerke.[].traction_effects_coeff.c_j| Koeffizient j|
|fahrwerke.[].traction_effects_coeff.anz_tax| Anzahl der Trieb         |
|fahrwerke.[].traction_effects_coeff.manuell| boolean|
|fahrwerke.[].traction_effects_coeff.ersatz_koeff_vonfzg| Beschreibt ob die Koeffizienten von einem anderen Fahrzeug übernommen wurden (Näherung)|
|fahrzeugart| string|
|ist_meterspur| Meterspurfzg (@dataOject rcf-test @column test-col)|
|angetrieben| Fahrzeug ist angetrieben (Lok oder Triebwagen)|
|gewicht_kg| {kg} Fahrzeugmasse |
|achsen| Anzahl Achsen des Fahrzuegs |
|laenge| {m} Länge über Kupplung/Puffer|
|vzul|   {km/h} Zulässige Geschwindigkeit |
|f_anf_n| {N} Anfahrzugrkaft|
|a0| Koeefizient der Alt-ZLR - Grundparameter |
|a1| Koeefizient der Alt-ZLR - Parameter a1 * V |
|a2| Koeefizient der Alt-ZLR - Parameter a2 * V^2 |
|fzg_ist_bekannt| Fahrzeug ist in der erweiterten Stammdatenfuehrung des DLFW bekannt (TPS-Groessen, SimErgebnisse). 