# Erweiterte Stammdaten zu den Fahrzeugen
Erweiterte Stammdaten des Fahrwerks geben die Werte der TPS-Einstufung 
der Fahrzeuge wieder. **Der Abzug von Fahrzeugebzogenen Stammdaten sollte vermieden werden **

@column `id_fahrtyp` ID des Fahrtyps
@column `betriebsmodus` Betriebsmodus. Der Betriebsmodus beschreibt 
                        Eigenschaftsänderungen des Fahrzeugs ohne physische Änderung des Fahrzuegs.
						Änderung der Zugkraftkennlinie Adhäsions und Zahnstangenbetrieb oder bei 
						Wechsel 16kV 162/3Hz auf 25kV,50Hz
@column `fahrtyp`  Fahrtypname 

## Stammdaten zu Regeluntstechnik der Fahrzeuge
Es werden die Grundlagen der regelungstechnischen Eigenschaften 
der Fahrzeuge geführt. Dieser Block erfährt eine komplette Neugestaltung und soll zukünftig das Quellfile, 
eine Enschätzung der Güte,eine mögliche Quellreferenz und die Angabe ob es Ersatzwerte sind verwalten. 
@column `adhaes`DEPRECATED Die grosse Detailierung ist mit der Vorberechnung hinfällig 
@column `adhaes.default_v0_d_v` DEPRECATED
@column `adhaes.dv_regler_kennl.[]` DEPRECATED
@column `adhaes.dv_regler_kennl.[].v0` DEPRECATED
@column `adhaes.dv_regler_kennl.[].d_v` DEPRECATED
@column `adhaes.dv_regler_kennl_quelle` DEPRECATED
@column `adhaes.kritische_kennl_neigung` DEPRECATED
@column `adhaes.antr_steuertyp_txt` DEPRECATED
@column `adhaes.antr_steuertyp_nr` DEPRECATED
@column `adhaes.ctaw_knmrad` DEPRECATED
@column `adhaes.jrad_kgm2` DEPRECATED
@column `adhaes.amp_as` DEPRECATED
@column `adhaes.amp_nas` DEPRECATED
@column `adhaes.frollier_hz` DEPRECATED
@column `adhaes.quellvermerke` DEPRECATED
@endColumn

This is a test for the endColumn annotation.
	
## Stammdaten zm Gesamtfahrzeug auf Achsebene 
@column `axs.[]` 
@column `axs.[].ax_nr`     Laufende Achsnummer im Fahrzeug 
@column `axs.[].dgtyp`     Typ des Drehgestells : LDG-Laufdrehgestell, TDG-Triebdrehgestell, J-LDG-Jakobslaufdrehgestell , ...
@column `axs.[].fuehrend`  Achse ist führend 
@column `axs.[].steuertyp` Typ der Leistungsübertragung> 0: KommutatorMotor/Schaltwerk, 1 Drehstromantrieb Einzelachs, 2: Drehstrom Gruppenantrieb, 3: Diesel (Ströumgsgetrieb, Dieselelektr.
@column `axs.[].antr_gr_no` Zuordnung zur Antriebsgruppe (Umrichter, Gelenkwelle) 
@column `axs.[].achsentl`   DEPRECATED Achsentlastungsfaktor (in Vorberechnung enthalten) 
@column `axs.[].q0_kn`  {kN} Radaufstandskraft 
@column `axs.[].mu_kg`  {kg} Unabgefederte Massen pro Radseite
@column `axs.[].drad_m`  {m} Raddurchmesser
@column `axs.[].prad_kw`{kW} Antriebsleistung pro Rad
@column `axs.[].yw`     {kN} Führungskräfte in Weichen, Simulation eines R185 Wechselbogen 
@column `axs.[].angetrieben` Achse angetrieben oder Laufachse 

## Stammdaten der TPS-Einstufung der Fahrzeuge (Fahrwerke)
@column `fahrwerke.[]` 
@column `fahrwerke.[].dgtyp` Gibt an ob Lauf,Jakobs oder Triebdrehgestell
@column `fahrwerke.[].n_ax` Anzahl der Achsen im Fahrwerk 
@column `fahrwerke.[].n_dg` Anzahl Fahrwerke im Fahrzeug 
@column `fahrwerke.[].q0_kn`   {kN} Radaufstandskraft 
@column `fahrwerke.[].mu_kg`   {kg} Ungefederte Masse pro Radseite
@column `fahrwerke.[].drad_m`   {m} Raddurchmesser 
@column `fahrwerke.[].prad_kw` {kW} Antriebsleistung pro Rad

## Stammdaten der Fahrzeuge, diskrete Einschätzung der Reibenergielasten des Fahrzeugs (ein führender Radsatz) 
@column `fahrwerke.[].lead_ax_wear_discret` 
@column `fahrwerke.[].lead_ax_wear_discret.wb_r600_1200` {J/m} Reibenergie im Bogenbereich R 600-1200m 
@column `fahrwerke.[].lead_ax_wear_discret.wb_r400_600` {J/m} Reibenergie im Bogenbereich R 400-600m 
@column `fahrwerke.[].lead_ax_wear_discret.wb_r300_400` {J/m} Reibenergie im Bogenbereich R 300-400m 
@column `fahrwerke.[].lead_ax_wear_discret.wb_r300` {J/m} Reibenergie im Bogenbereich R<300m
@column `fahrwerke.[].lead_ax_wear_discret.yw` {kN} Führungskräfte in Weichen, Simulation eines R185 Wechselbogen 

@column `fahrwerke.[].lead_ax_ty_fit.wb_typ` Funktionstyp der Verwendung der Koeffzientena a,b in der Ermittlung 
der Reibenergie wb{J/m} abhänging vom Bogenradius abs(R) R in {m} 
[ConfluenceSeite zur HeadcheckPorgnose und Traktionsueberhoehung](https://confluence.sbb.ch/pages/viewpage.action?pageId=1524926686).

 l. l: linear      wb(1/R) = `a*(1/R) + b`
 2. p: potenz      wb(1/R) = a*(1/R)^b
 3. e: exponentiel wb(1/R) = a*e^((1/R)^b)
@column `fahrwerke.[].lead_ax_ty_fit.wb_a` Koffizient a 
@column `fahrwerke.[].lead_ax_ty_fit.wb_b` Koffizient b
@column `fahrwerke.[].smpck_model` 
@column `fahrwerke.[].smpck_model.interpol_fakt` {-} Faktor bei Verwendung von anderen Sim.Modellen in der Massenanpassung
@column `fahrwerke.[].smpck_model.sim_q0_max` {kN} Maximale Radaufstandskraft im Simulationsmodel, Gegenvergleichszweck 
@column `fahrwerke.[].smpck_model.q0_quelle` Quellvermerke für Radaufstandskräfte 
@column `fahrwerke.[].smpck_model.mu_quelle` Quellvermerke für unabgefederte Massen 
@column `fahrwerke.[].smpck_model.schaetzung` Flag, im Falle keiner eigenen Simulation sondern Vererbung von anderen artverwandten Modellen
@column `fahrwerke.[].smpck_model.smpck_file` Name des Modellfiles von Simpack 
@column `fahrwerke.[].smpck_model.bemerkungen` Bemerkungen, Freitext 

## Koeffizienten der Traktionsüberhoehung
Reibenergeien werden bogenabhängig durch Zugkrafteinfluss überhöht. Dazu müssen 
pro Fahrzeug im rollenden Zustand Zusatzsimulationen ausgeführt werden. 
Weil das in Menge und Zeit nicht ging werden auch Ergebnisse von anderen Fahrzeugen vererbt. 
Mit dem Neuaufsetzen in HC2.1 und einer geschlossenen Berechnung wird wb-Fit und 
Zugkraftüberhöhung hinfällig. Es kommen aus dem Programm TableCurve 3D nur Fitfunktionen zur Anwendung :
1. Eq303 : z=a+b/x+cy+d/x^2+ey^2+fy/x
2. Eq310 : z=a+bx+cy+dx^2+ey^2+fxy+gx^3+hy^3+ixy^2
mit x = abs(1/R) (Krümmung)  und y = Fsoll/F_anf (Sollzugkraftauschöpfung gegenüber Anfahrzugkraft) 

@column `fahrwerke.[].traction_effects_coeff` 
@column `fahrwerke.[].traction_effects_coeff.c_typ` Referenziert auf das Programm TableCurve 3D welche Fitfunktionsnummer verwendet wurde  (Eq303, Eq310)
@column `fahrwerke.[].traction_effects_coeff.c_a` Koeffizient a
@column `fahrwerke.[].traction_effects_coeff.c_b` Koeffizient b
@column `fahrwerke.[].traction_effects_coeff.c_c` Koeffizient c
@column `fahrwerke.[].traction_effects_coeff.c_d` Koeffizient d
@column `fahrwerke.[].traction_effects_coeff.c_e` Koeffizient e
@column `fahrwerke.[].traction_effects_coeff.c_f` Koeffizient f
@column `fahrwerke.[].traction_effects_coeff.c_g` Koeffizient g
@column `fahrwerke.[].traction_effects_coeff.c_h` Koeffizient h
@column `fahrwerke.[].traction_effects_coeff.c_i` Koeffizient i 
@column `fahrwerke.[].traction_effects_coeff.c_j` Koeffizient j
@column `fahrwerke.[].traction_effects_coeff.anz_tax` Anzahl der Trieb         
@column `fahrwerke.[].traction_effects_coeff.manuell` boolean
@column `fahrwerke.[].traction_effects_coeff.ersatz_koeff_vonfzg` Beschreibt ob die Koeffizienten von einem anderen Fahrzeug übernommen wurden (Näherung)

@column `fahrzeugart` string
@column `ist_meterspur` Meterspurfzg (@dataObject rcf-test @column test-col)
@column `angetrieben` Fahrzeug ist angetrieben (Lok oder Triebwagen) @dataObject btl-distances . Test für den Parser. @dataObject btl-distances @column xyz. 
@column `gewicht_kg` {kg} Fahrzeugmasse 
@column `achsen` Anzahl Achsen des Fahrzuegs 
@column `laenge` {m} Länge über Kupplung/Puffer
@column `vzul`   {km/h} Zulässige Geschwindigkeit 
@column `f_anf_n` {N} Anfahrzugrkaft
@column `a0` Koeefizient der Alt-ZLR - Grundparameter 
@column `a1` Koeefizient der Alt-ZLR - Parameter a1 * V 
@column `a2` Koeefizient der Alt-ZLR - Parameter a2 * V^2 
@column `fzg_ist_bekannt` Fahrzeug ist in der erweiterten Stammdatenfuehrung des DLFW bekannt (TPS-Groessen, SimErgebnisse). 
