# -*- coding: utf-8 -*-
# Data extracted from Dudi's BBQ tables (sous-vide+smoke, smoke-only, comparison, specials, glossary)

# keys: n,cat,heb,eng,kg,svt,svh,smt,smh,tgt,safe,sear,mid,wrap,rest,rub,wood,coal,diff,sot,soh,somid,saved
CUTS = [
 dict(n=1,cat="בקר",heb="בריסקט",eng="Brisket",kg=5.5,svt=68,svh="30",smt=105,smh="3",tgt=95,safe=63,sear="לא",mid="צינון מלא",wrap="לא",rest=60,rub="מלח+פלפל גס (טקסני)",wood="אלון/היקורי",coal="Fogo Super Premium",diff=5,sot=110,soh="12",somid="עטיפה ב-70°C",saved=9.0),
 dict(n=2,cat="בקר",heb="אסאדו",eng="Short Ribs",kg=2.5,svt=68,svh="36",smt=105,smh="3",tgt=95,safe=63,sear="גלייז",mid="אין",wrap="לא",rest=30,rub="ראב בקר + שום",wood="אלון/מזקיט",coal="Fogo Super Premium",diff=4,sot=110,soh="7",somid="גלייז בסיום",saved=4.0),
 dict(n=3,cat="הודו",heb="שווארמה",eng="Hanging Shawarma",kg=2.0,svt=74,svh="12",smt=105,smh="1.5",tgt=75,safe=74,sear="כן",mid="אין",wrap="לא",rest=10,rub="תערובת שווארמה + שמן זית",wood="תפוח/פקאן",coal="Fogo Premium",diff=3,sot=110,soh="3.5",somid="סיבוב שיפוד",saved=2.0),
 dict(n=4,cat="טלה",heb="שוק טלה",eng="Lamb Shank",kg=0.5,svt=74,svh="24",smt=105,smh="2",tgt=95,safe=63,sear="כן",mid="אין",wrap="לא",rest=15,rub="שום+רוזמרין+מלח",wood="דובדבן/פקאן",coal="Fogo Premium",diff=4,sot=110,soh="7",somid="עטיפה ב-75°C",saved=5.0),
 dict(n=5,cat="עוף",heb="פרגיות",eng="Chicken Thighs",kg=1.0,svt=65,svh="2",smt=120,smh="0.5",tgt=75,safe=74,sear="כן",mid="ייבוש",wrap="לא",rest=5,rub="ראב עוף + לימון",wood="אלון/תפוח",coal="Weber Lump",diff=2,sot=130,soh="1.5",somid="מריחה",saved=1.0),
 dict(n=6,cat="בקר",heb="פיקאניה",eng="Picanha",kg=1.3,svt=54,svh="2-4",smt=100,smh="0.75",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=10,rub="מלח גס בלבד",wood="דובדבן/פקאן",coal="Kamado Joe",diff=2,sot=110,soh="2.5",somid="אין",saved=1.8),
 dict(n=7,cat="חזיר",heb="ספייריבס",eng="Pork Ribs",kg=1.5,svt=74,svh="24",smt=110,smh="2",tgt=95,safe=63,sear="לא",mid="גלייז",wrap="לא",rest=15,rub="ראב מתוק + פפריקה",wood="היקורי/תפוח",coal="Weber Lump",diff=3,sot=107,soh="5",somid="שיטת 3-2-1",saved=3.0),
 dict(n=8,cat="חזיר",heb="בטן חזיר",eng="Pork Belly",kg=2.0,svt=72,svh="12",smt=110,smh="1",tgt=90,safe=63,sear="כן",mid="אין",wrap="לא",rest=15,rub="ראב מתוק-מלוח",wood="היקורי/תפוח",coal="Fogo Premium",diff=3,sot=110,soh="4",somid="מריחה",saved=3.0),
 dict(n=9,cat="אווז",heb="חזה אווז",eng="Goose Breast",kg=0.4,svt=63,svh="3",smt=105,smh="0.75",tgt=65,safe=74,sear="כן",mid="ייבוש",wrap="לא",rest=8,rub="תפוז+פלפל+מלח",wood="דובדבן נקי",coal="Kamado Joe",diff=3,sot=110,soh="1.5",somid="הפיכה",saved=0.8),
 dict(n=10,cat="בקר",heb="לחי בקר",eng="Beef Cheeks",kg=1.0,svt=80,svh="24",smt=105,smh="2",tgt=95,safe=63,sear="לא",mid="אין",wrap="לא",rest=20,rub="ראב בקר",wood="היקורי/אלון",coal="Fogo Super Premium",diff=3,sot=110,soh="8",somid="עטיפה ב-75°C",saved=6.0),
 dict(n=11,cat="בקר",heb="טומאהוק",eng="Tomahawk",kg=1.2,svt=54,svh="2-3",smt=100,smh="0.75",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=15,rub="מלח+פלפל גס",wood="היקורי/אלון",coal="Kamado Joe",diff=3,sot=110,soh="2",somid="אין",saved=1.3),
 dict(n=12,cat="בקר",heb="פסטרמה בקר",eng="Beef Pastrami",kg=2.5,svt=65,svh="24-36",smt=105,smh="2",tgt=72,safe=63,sear="לא",mid="אין",wrap="לא",rest=30,rub="כבישה + ציפוי כוסברה+פלפל",wood="היקורי/אלון",coal="Fogo Premium",diff=4,sot=107,soh="6-8",somid="אין",saved=3.0),
 dict(n=13,cat="חזיר",heb="כתף חזיר",eng="Pork Shoulder",kg=4.0,svt=74,svh="24",smt=110,smh="2",tgt=95,safe=63,sear="לא",mid="מריחה",wrap="לא",rest=45,rub="ראב מתוק (פולד פורק)",wood="היקורי/תפוח",coal="Fogo Super Premium",diff=3,sot=105,soh="12",somid="עטיפה ב-70°C",saved=10.0),
 dict(n=14,cat="בקר",heb="צוואר בקר",eng="Beef Chuck",kg=2.5,svt=74,svh="24",smt=110,smh="2",tgt=95,safe=63,sear="לא",mid="אין",wrap="לא",rest=30,rub="ראב בקר",wood="אלון/היקורי",coal="Fogo Super Premium",diff=4,sot=110,soh="9",somid="עטיפה ב-75°C",saved=7.0),
 dict(n=15,cat="טלה",heb="כתף טלה",eng="Lamb Shoulder",kg=2.0,svt=70,svh="20",smt=105,smh="2",tgt=95,safe=63,sear="לא",mid="אין",wrap="לא",rest=20,rub="מלח+שום+זעתר",wood="תפוח/פקאן",coal="Fogo Premium",diff=3,sot=115,soh="7",somid="עטיפה ב-75°C",saved=5.0),
 dict(n=16,cat="נקניקיות",heb="נקניקיות מוכנות",eng="Ready Sausages",kg=1.0,svt=65,svh="1-2",smt=90,smh="0.75",tgt=71,safe=71,sear="לא",mid="ייבוש",wrap="לא",rest=5,rub="ללא (מתובל מראש)",wood="פקאן/תפוח",coal="Weber Lump",diff=1,sot=100,soh="2.5",somid="הפיכה",saved=1.8),
 dict(n=17,cat="בקר",heb="קבב",eng="Kebab",kg=1.0,svt=55,svh="2-3",smt=105,smh="0.33",tgt=65,safe=71,sear="כן",mid="אין",wrap="לא",rest=5,rub="תיבול קבב (בצל+פטרוזיליה)",wood="אלון בלבד",coal="Fogo Premium",diff=2,sot=120,soh="0.67",somid="אין",saved=0.3),
 dict(n=18,cat="בקר",heb="המבורגר",eng="Hamburger",kg=0.2,svt=55,svh="2.5",smt=85,smh="0.25",tgt=55,safe=71,sear="כן",mid="ייבוש",wrap="לא",rest=5,rub="מלח+פלפל",wood="אלון/היקורי",coal="Weber Lump",diff=1,sot=120,soh="0.67",somid="אין",saved=0.4),
 dict(n=19,cat="הודו",heb="חזה הודו",eng="Turkey Breast",kg=2.5,svt=65,svh="3",smt=105,smh="1",tgt=75,safe=74,sear="לא",mid="אין",wrap="לא",rest=20,rub="כבישה מלח + ראב עדין",wood="דובדבן/תפוח",coal="Weber Lump",diff=3,sot=110,soh="4",somid="עטיפה ב-65°C",saved=3.0),
 dict(n=20,cat="בקר",heb="טרי-טיפ",eng="Tri-Tip",kg=1.3,svt=54,svh="4-6",smt=110,smh="0.5",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=15,rub="שום+פלפל+מלח",wood="היקורי/אלון",coal="Kamado Joe",diff=2,sot=120,soh="2",somid="הפיכה",saved=1.5),
 dict(n=21,cat="בקר",heb="צלעות בקר (דינו)",eng="Beef Back Ribs",kg=2.5,svt=68,svh="24",smt=110,smh="3",tgt=95,safe=63,sear="לא",mid="אין",wrap="לא",rest=30,rub="ראב בקר קלאסי",wood="היקורי/אלון",coal="Fogo Super Premium",diff=3,sot=110,soh="6.5",somid="עטיפה ב-75°C",saved=3.5),
 dict(n=22,cat="בקר",heb="לשון בקר",eng="Beef Tongue",kg=1.2,svt=70,svh="24-48",smt=105,smh="2",tgt=70,safe=63,sear="לא",mid="קילוף קרום",wrap="לא",rest=20,rub="מלח+פלפל+כמון",wood="היקורי/אלון",coal="Fogo Premium",diff=4,sot=110,soh="6",somid="עטיפה ב-75°C",saved=4.0),
 dict(n=23,cat="בקר",heb="אנטריקוט רוסט",eng="Prime Rib Roast",kg=3.5,svt=56,svh="6-8",smt=110,smh="1",tgt=56,safe=63,sear="כן",mid="צינון",wrap="לא",rest=20,rub="שום+רוזמרין+פלפל+מלח",wood="דובדבן/אלון",coal="Fogo Super Premium",diff=3,sot=120,soh="3",somid="אין",saved=2.0),
 dict(n=24,cat="בקר",heb="אונטרייב",eng="Chuck Short Ribs",kg=1.5,svt=68,svh="24",smt=110,smh="3",tgt=95,safe=63,sear="לא",mid="אין",wrap="לא",rest=30,rub="ראב בקר+שום",wood="אלון/היקורי",coal="Fogo Super Premium",diff=4,sot=110,soh="7",somid="עטיפה ב-75°C",saved=4.0),
 dict(n=25,cat="בקר",heb="שריר בקר (אוסובוקו)",eng="Beef Shank",kg=1.8,svt=74,svh="24",smt=110,smh="2",tgt=96,safe=63,sear="לא",mid="אין",wrap="לא",rest=30,rub="ראב בקר",wood="אלון/היקורי",coal="Fogo Super Premium",diff=4,sot=110,soh="8",somid="עטיפה ב-75°C",saved=6.0),
 dict(n=26,cat="בקר",heb="סינטה רוסט",eng="Striploin Roast",kg=2.5,svt=54,svh="4-6",smt=110,smh="0.75",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=20,rub="מלח גס+פלפל",wood="אלון/היקורי",coal="Fogo Premium",diff=3,sot=120,soh="2.5",somid="אין",saved=1.8),
 dict(n=27,cat="בקר",heb="פילה בקר",eng="Beef Tenderloin",kg=1.5,svt=54,svh="2-4",smt=100,smh="0.5",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=15,rub="חמאה+פלפל+מלח",wood="דובדבן/אלון",coal="Kamado Joe",diff=2,sot=120,soh="1.5",somid="הפיכה",saved=1.0),
 dict(n=28,cat="בקר",heb="ואסיו",eng="Vacío",kg=1.2,svt=56,svh="8-12",smt=110,smh="0.5",tgt=56,safe=63,sear="כן",mid="אין",wrap="לא",rest=15,rub="מלח גס+צ'ימיצ'ורי",wood="אלון/היקורי",coal="Weber Lump",diff=3,sot=110,soh="2.5",somid="הפיכה",saved=2.0),
 dict(n=29,cat="חזיר",heb="פילה חזיר",eng="Pork Loin",kg=1.8,svt=60,svh="3-4",smt=110,smh="1",tgt=63,safe=63,sear="כן",mid="אין",wrap="לא",rest=15,rub="ראב מתוק+פפריקה",wood="דובדבן/תפוח",coal="Fogo Premium",diff=2,sot=110,soh="2.5",somid="מריחה",saved=1.5),
 dict(n=30,cat="חזיר",heb="פילה חזיר מדומה",eng="Pork Tenderloin",kg=0.5,svt=60,svh="2",smt=110,smh="0.5",tgt=63,safe=63,sear="כן",mid="אין",wrap="לא",rest=10,rub="חרדל+ראב",wood="תפוח",coal="Weber Lump",diff=1,sot=110,soh="1.5",somid="הפיכה",saved=1.0),
 dict(n=31,cat="חזיר",heb="צוואר חזיר",eng="Pork Collar",kg=1.8,svt=68,svh="18-24",smt=110,smh="2",tgt=88,safe=63,sear="לא",mid="אין",wrap="לא",rest=20,rub="ראב חזיר",wood="היקורי/תפוח",coal="Fogo Premium",diff=3,sot=110,soh="6",somid="עטיפה ב-70°C",saved=4.0),
 dict(n=32,cat="חזיר",heb="רגל חזיר",eng="Fresh Ham",kg=5.0,svt=65,svh="24",smt=110,smh="3",tgt=71,safe=63,sear="לא",mid="גלייז",wrap="לא",rest=30,rub="ראב מתוק+ציפורן",wood="דובדבן/תפוח",coal="Fogo Super Premium",diff=4,sot=110,soh="9",somid="גלייז בסיום",saved=6.0),
 dict(n=33,cat="חזיר",heb="קוטלט חזיר",eng="Pork Chops",kg=0.4,svt=60,svh="1-2",smt=110,smh="0.33",tgt=63,safe=63,sear="כן",mid="אין",wrap="לא",rest=8,rub="מלח+פלפל+מרווה",wood="תפוח",coal="Weber Lump",diff=2,sot=110,soh="1",somid="הפיכה",saved=0.7),
 dict(n=34,cat="טלה",heb="צלעות טלה",eng="Lamb Ribs",kg=1.0,svt=68,svh="18",smt=105,smh="2",tgt=90,safe=63,sear="לא",mid="גלייז",wrap="לא",rest=15,rub="ראב טלה+זעתר",wood="דובדבן/פקאן",coal="Fogo Premium",diff=3,sot=110,soh="4",somid="עטיפה ב-75°C",saved=2.0),
 dict(n=35,cat="טלה",heb="ירך טלה",eng="Leg of Lamb",kg=2.5,svt=56,svh="6-8",smt=110,smh="1.5",tgt=57,safe=63,sear="כן",mid="צינון",wrap="לא",rest=20,rub="שום+רוזמרין+מלח",wood="דובדבן/פקאן",coal="Fogo Super Premium",diff=3,sot=107,soh="3.5",somid="אין",saved=2.0),
 dict(n=36,cat="טלה",heb="צלעות כבש (קארה)",eng="Rack of Lamb",kg=0.7,svt=56,svh="2-3",smt=100,smh="0.5",tgt=56,safe=63,sear="כן",mid="אין",wrap="לא",rest=10,rub="חרדל+עשבי תיבול",wood="תפוח/דובדבן",coal="Kamado Joe",diff=3,sot=107,soh="1",somid="הפיכה",saved=0.5),
 dict(n=37,cat="טלה",heb="חזה טלה",eng="Lamb Breast",kg=1.2,svt=70,svh="20-24",smt=110,smh="2",tgt=92,safe=63,sear="לא",mid="אין",wrap="לא",rest=20,rub="ראב טלה",wood="אלון/פקאן",coal="Fogo Premium",diff=3,sot=110,soh="5",somid="עטיפה ב-75°C",saved=3.0),
 dict(n=38,cat="עוף",heb="עוף שלם (ספאצ'קוק)",eng="Spatchcock Chicken",kg=1.7,svt=65,svh="2-3",smt=130,smh="0.75",tgt=74,safe=74,sear="כן",mid="ייבוש עור",wrap="לא",rest=10,rub="ראב עוף+פפריקה",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=150,soh="1.75",somid="אין",saved=1.0),
 dict(n=39,cat="עוף",heb="כנפיים",eng="Chicken Wings",kg=1.0,svt=65,svh="1-2",smt=150,smh="0.5",tgt=74,safe=74,sear="כן",mid="ייבוש עור",wrap="לא",rest=5,rub="ראב עוף / באפלו",wood="דובדבן/תפוח",coal="Weber Lump",diff=1,sot=150,soh="1.5",somid="הפיכה",saved=1.0),
 dict(n=40,cat="עוף",heb="שוקיים",eng="Chicken Drumsticks",kg=1.0,svt=70,svh="2",smt=130,smh="0.67",tgt=80,safe=74,sear="כן",mid="ייבוש עור",wrap="לא",rest=5,rub="ראב עוף",wood="אלון/תפוח",coal="Weber Lump",diff=1,sot=140,soh="1.5",somid="מריחה",saved=0.8),
 dict(n=41,cat="עוף",heb="חזה עוף",eng="Chicken Breast",kg=0.4,svt=65,svh="1.5-2",smt=120,smh="0.33",tgt=68,safe=74,sear="לא",mid="אין",wrap="לא",rest=8,rub="ראב עדין+לימון",wood="דובדבן/תפוח",coal="Fogo Premium",diff=2,sot=120,soh="1",somid="מריחה",saved=0.7),
 dict(n=42,cat="הודו",heb="שוק הודו",eng="Turkey Legs",kg=1.0,svt=74,svh="8-12",smt=110,smh="1",tgt=85,safe=74,sear="לא",mid="ייבוש עור",wrap="לא",rest=15,rub="כבישה+מלח+ראב",wood="דובדבן/תפוח",coal="Fogo Premium",diff=2,sot=120,soh="3",somid="עטיפה ב-70°C",saved=2.0),
 dict(n=43,cat="הודו",heb="הודו שלם",eng="Whole Turkey",kg=6.0,svt=63,svh="4-5",smt=130,smh="2",tgt=74,safe=74,sear="לא",mid="ייבוש עור",wrap="לא",rest=30,rub="כבישה+חמאת עשבים+מלח",wood="תפוח/דובדבן",coal="Fogo Super Premium",diff=4,sot=150,soh="4.5",somid="עטיפת חזה",saved=2.5),
 dict(n=44,cat="אווז",heb="אווז שלם",eng="Whole Goose",kg=4.5,svt=64,svh="6",smt=120,smh="2",tgt=74,safe=74,sear="כן",mid="ניקוז שומן",wrap="לא",rest=25,rub="עשבים+תפוז+מלח",wood="תפוח/דובדבן",coal="Fogo Super Premium",diff=5,sot=130,soh="4.5",somid="דקירת עור+ניקוז",saved=2.5),
 dict(n=45,cat="אווז",heb="שוק אווז (קונפי)",eng="Goose Leg",kg=0.5,svt=80,svh="8-10",smt=110,smh="0.75",tgt=85,safe=74,sear="כן",mid="אין",wrap="לא",rest=10,rub="שום+תימין+מלח",wood="דובדבן",coal="Fogo Premium",diff=3,sot=120,soh="2.5",somid="הפיכה",saved=1.8),
 dict(n=46,cat="ברווז",heb="ברווז שלם",eng="Whole Duck",kg=2.2,svt=64,svh="4-5",smt=130,smh="1.5",tgt=74,safe=74,sear="כן",mid="דקירת עור+ניקוז",wrap="לא",rest=15,rub="מלח+חמישה תבלינים",wood="דובדבן/תפוח",coal="Fogo Premium",diff=4,sot=140,soh="2.75",somid="דקירת עור",saved=1.3),
 dict(n=47,cat="ברווז",heb="שוק ברווז (קונפי)",eng="Duck Leg Confit",kg=0.3,svt=80,svh="8",smt=110,smh="0.5",tgt=85,safe=74,sear="כן",mid="אין",wrap="לא",rest=8,rub="מלח+תימין+שום",wood="דובדבן",coal="Fogo Premium",diff=3,sot=120,soh="2",somid="הפיכה",saved=1.5),
 dict(n=48,cat="ברווז",heb="חזה ברווז",eng="Duck Breast",kg=0.4,svt=57,svh="2",smt=100,smh="0.33",tgt=57,safe=74,sear="כן",mid="חריטת עור",wrap="לא",rest=8,rub="מלח+פלפל+תפוז",wood="דובדבן",coal="Kamado Joe",diff=2,sot=120,soh="0.75",somid="הפיכת עור",saved=0.4),
 dict(n=49,cat="דג",heb="סלמון",eng="Salmon Fillet",kg=1.0,svt=50,svh="0.75",smt=80,smh="0.5",tgt=52,safe=63,sear="לא",mid="אין",wrap="לא",rest=5,rub="מלח+סוכר חום (גרבלקס)",wood="דובדבן/תפוח",coal="Weber Lump",diff=2,sot=80,soh="2",somid="גלייז מייפל",saved=1.5),
 dict(n=50,cat="דג",heb="פורל",eng="Trout",kg=0.4,svt=50,svh="0.5",smt=80,smh="0.33",tgt=54,safe=63,sear="לא",mid="אין",wrap="לא",rest=5,rub="מלח+שמיר+לימון",wood="דובדבן/תפוח",coal="Weber Lump",diff=2,sot=80,soh="1.5",somid="אין",saved=1.2),
 dict(n=51,cat="בקר",heb="שפונדרה",eng="Short Plate",kg=2.5,svt=68,svh="24",smt=110,smh="3",tgt=95,safe=63,sear="לא",mid="אין",wrap="לא",rest=30,rub="ראב בקר",wood="אלון/היקורי",coal="Fogo Super Premium",diff=4,sot=110,soh="7",somid="עטיפה ב-75°C",saved=4.0),
 dict(n=52,cat="בקר",heb="כתף בקר",eng="Chuck Roast",kg=2.5,svt=74,svh="24",smt=110,smh="2",tgt=95,safe=63,sear="לא",mid="אין",wrap="לא",rest=30,rub="ראב בקר",wood="פקאן/אלון",coal="Fogo Super Premium",diff=4,sot=110,soh="7",somid="עטיפה ב-75°C",saved=5.0),
 dict(n=53,cat="בקר",heb="מכסה אנטריקוט",eng="Rib Cap (Spinalis)",kg=0.8,svt=54,svh="3-4",smt=110,smh="0.5",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=10,rub="מלח+פלפל",wood="פקאן/אלון",coal="Kamado Joe",diff=2,sot=120,soh="2",somid="אין",saved=1.5),
 dict(n=54,cat="בקר",heb="שייטל",eng="Top Round",kg=2.0,svt=56,svh="8-10",smt=110,smh="0.75",tgt=56,safe=63,sear="כן",mid="צינון",wrap="לא",rest=15,rub="שום+פלפל+מלח",wood="דובדבן/פקאן",coal="Fogo Premium",diff=2,sot=120,soh="3",somid="אין",saved=2.3),
 dict(n=55,cat="בקר",heb="שפיץ צ'אך",eng="Rump Roast",kg=2.0,svt=56,svh="8",smt=110,smh="0.75",tgt=56,safe=63,sear="כן",mid="צינון",wrap="לא",rest=15,rub="מלח גס+פלפל",wood="דובדבן/אלון",coal="Fogo Premium",diff=2,sot=120,soh="3",somid="אין",saved=2.3),
 dict(n=56,cat="בקר",heb="זנב שור",eng="Oxtail",kg=1.5,svt=79,svh="24-48",smt=110,smh="2",tgt=95,safe=63,sear="לא",mid="אין",wrap="לא",rest=20,rub="ראב בקר",wood="אלון/היקורי",coal="Fogo Super Premium",diff=4,sot=110,soh="6",somid="עטיפה ב-75°C",saved=4.0),
 dict(n=57,cat="בקר",heb="עצמות מח עצם",eng="Beef Marrow Bones",kg=1.0,svt=64,svh="1",smt=110,smh="0.5",tgt=65,safe=63,sear="לא",mid="אין",wrap="לא",rest=5,rub="מלח גס",wood="אלון",coal="Weber Lump",diff=2,sot=150,soh="0.67",somid="אין",saved=1.0),
 dict(n=58,cat="טלה",heb="אסאדו טלה",eng="Lamb Plate Ribs",kg=1.2,svt=68,svh="18",smt=105,smh="2",tgt=92,safe=63,sear="לא",mid="גלייז",wrap="לא",rest=20,rub="ראב טלה+זעתר",wood="דובדבן/אלון",coal="Fogo Premium",diff=4,sot=110,soh="5",somid="עטיפה ב-75°C",saved=3.0),
 dict(n=59,cat="טלה",heb="צוואר טלה",eng="Lamb Neck",kg=1.0,svt=72,svh="20",smt=105,smh="2",tgt=92,safe=63,sear="לא",mid="אין",wrap="לא",rest=20,rub="ראב טלה",wood="אלון/דובדבן",coal="Fogo Premium",diff=4,sot=110,soh="5",somid="עטיפה ב-75°C",saved=3.0),
 dict(n=60,cat="טלה",heb="מותן טלה",eng="Lamb Loin",kg=1.0,svt=56,svh="2-3",smt=100,smh="0.5",tgt=56,safe=63,sear="כן",mid="אין",wrap="לא",rest=10,rub="שום+רוזמרין+מלח",wood="דובדבן",coal="Kamado Joe",diff=2,sot=107,soh="2",somid="הפיכה",saved=1.5),
 dict(n=61,cat="חזיר",heb="לחי חזיר",eng="Pork Cheek (Jowl)",kg=0.5,svt=74,svh="18-24",smt=110,smh="1.5",tgt=90,safe=63,sear="לא",mid="אין",wrap="לא",rest=15,rub="ראב חזיר",wood="דובדבן/תפוח",coal="Fogo Premium",diff=4,sot=110,soh="4",somid="עטיפה ב-75°C",saved=2.5),
 dict(n=62,cat="חזיר",heb="פרק חזיר",eng="Pork Hock",kg=0.8,svt=75,svh="24",smt=110,smh="2",tgt=94,safe=63,sear="לא",mid="אין",wrap="לא",rest=15,rub="כבישה+מלח+ראב חזיר",wood="היקורי/תפוח",coal="Fogo Premium",diff=4,sot=110,soh="5",somid="עטיפה ב-75°C",saved=3.0),
 dict(n=63,cat="חזיר",heb="חזה חזיר עם עצם",eng="Picnic Shoulder",kg=3.5,svt=74,svh="24",smt=110,smh="3",tgt=95,safe=63,sear="לא",mid="מריחה",wrap="לא",rest=30,rub="ראב מתוק",wood="תפוח/פקאן",coal="Fogo Super Premium",diff=4,sot=110,soh="8",somid="עטיפה ב-70°C",saved=5.0),
 dict(n=64,cat="חזיר",heb="ריבס אמריקאי",eng="Baby Back Ribs",kg=0.8,svt=72,svh="12",smt=110,smh="2",tgt=92,safe=63,sear="לא",mid="גלייז",wrap="לא",rest=10,rub="ראב מתוק+פפריקה",wood="דובדבן/תפוח",coal="Weber Lump",diff=3,sot=110,soh="5",somid="שיטת 2-2-1",saved=3.0),
 dict(n=65,cat="חזיר",heb="אוזן חזיר",eng="Pork Ear",kg=0.2,svt=75,svh="8",smt=120,smh="0.5",tgt=78,safe=63,sear="כן",mid="אין",wrap="לא",rest=5,rub="פפריקה+מלח",wood="היקורי/תפוח",coal="Weber Lump",diff=2,sot=120,soh="1.5",somid="הפיכה",saved=1.0),
 dict(n=66,cat="חזיר",heb="זנב חזיר",eng="Pork Tail",kg=0.3,svt=75,svh="12",smt=120,smh="0.75",tgt=80,safe=63,sear="כן",mid="אין",wrap="לא",rest=5,rub="ראב חזיר",wood="תפוח",coal="Weber Lump",diff=2,sot=120,soh="2.5",somid="הפיכה",saved=1.8),
 dict(n=67,cat="עוף",heb="כרעיים",eng="Chicken Leg Quarters",kg=1.0,svt=70,svh="2",smt=130,smh="0.67",tgt=80,safe=74,sear="כן",mid="ייבוש עור",wrap="לא",rest=5,rub="ראב עוף",wood="דובדבן/תפוח",coal="Weber Lump",diff=1,sot=140,soh="2",somid="מריחה",saved=1.3),
 dict(n=68,cat="הודו",heb="כנפי הודו",eng="Turkey Wings",kg=0.8,svt=74,svh="4",smt=120,smh="1",tgt=80,safe=74,sear="לא",mid="ייבוש עור",wrap="לא",rest=10,rub="כבישה+מלח+ראב",wood="תפוח/פקאן",coal="Fogo Premium",diff=2,sot=130,soh="3",somid="אין",saved=2.0),
 # ── איברים פנימיים (offal) ──
 dict(n=69,cat="איברים פנימיים",heb="לב בקר",eng="Beef Heart",kg=1.5,svt=55,svh="2",smt=120,smh="0.5",tgt=55,safe=63,sear="כן",mid="אין",wrap="לא",rest=5,rub="מלח+פלפל+שום",wood="אלון",coal="Weber Lump",diff=2,sot=120,soh="0.5",somid="פרוס דק, חם ומהיר",saved=0.5),
 dict(n=70,cat="איברים פנימיים",heb="לבבות עוף",eng="Chicken Hearts",kg=0.5,svt=68,svh="1.5",smt=130,smh="0.4",tgt=68,safe=74,sear="כן",mid="אין",wrap="לא",rest=3,rub="מלח+פלפל+לימון",wood="תפוח",coal="Weber Lump",diff=1,sot=130,soh="0.5",somid="על שיפוד",saved=0.4),
 dict(n=71,cat="איברים פנימיים",heb="כבד עוף",eng="Chicken Liver",kg=0.5,svt=74,svh="1",smt=120,smh="0.3",tgt=74,safe=74,sear="כן",mid="אין",wrap="לא",rest=3,rub="מלח+פלפל",wood="תפוח",coal="Weber Lump",diff=2,sot=120,soh="0.4",somid="עד שאין ורוד",saved=0.3),
 dict(n=72,cat="איברים פנימיים",heb="כבד בקר",eng="Beef Liver",kg=0.7,svt=72,svh="1.5",smt=120,smh="0.4",tgt=72,safe=72,sear="כן",mid="אין",wrap="לא",rest=5,rub="מלח+פלפל+בצל",wood="אלון",coal="Weber Lump",diff=2,sot=120,soh="0.5",somid="פרוס דק, עד סוף",saved=0.4),
 dict(n=73,cat="איברים פנימיים",heb="כבד טלה",eng="Lamb Liver",kg=0.5,svt=72,svh="1.5",smt=120,smh="0.4",tgt=72,safe=72,sear="כן",mid="אין",wrap="לא",rest=5,rub="מלח+פלפל+כמון",wood="דובדבן",coal="Weber Lump",diff=2,sot=120,soh="0.5",somid="עד סוף לבטיחות",saved=0.4),
 dict(n=74,cat="איברים פנימיים",heb="כבד אווז",eng="Goose Liver",kg=0.4,svt=65,svh="1",smt=110,smh="0.3",tgt=65,safe=65,sear="עדין",mid="אין",wrap="לא",rest=5,rub="מלח עדין",wood="ללא",coal="Weber Lump",diff=3,sot=110,soh="0.4",somid="בישול עדין",saved=0.3),
 dict(n=75,cat="איברים פנימיים",heb="שקדי עגל",eng="Veal Sweetbreads",kg=0.5,svt=65,svh="2",smt=120,smh="0.4",tgt=65,safe=65,sear="כן",mid="בלאנץ׳ + קרח",wrap="לא",rest=5,rub="מלח+חמאה+לימון",wood="אלון",coal="Weber Lump",diff=4,sot=120,soh="0.5",somid="בלאנץ׳ ואז צריבה",saved=0.5),
 dict(n=76,cat="איברים פנימיים",heb="שקדי טלה",eng="Lamb Sweetbreads",kg=0.4,svt=65,svh="2",smt=120,smh="0.4",tgt=65,safe=65,sear="כן",mid="בלאנץ׳ + קרח",wrap="לא",rest=5,rub="מלח+חמאה",wood="דובדבן",coal="Weber Lump",diff=4,sot=120,soh="0.5",somid="בלאנץ׳ ואז צריבה",saved=0.5),
 dict(n=77,cat="איברים פנימיים",heb="קורקבני עוף",eng="Chicken Gizzards",kg=0.5,svt=90,svh="4",smt=120,smh="1",tgt=90,safe=74,sear="כן",mid="הסרת קרום פנימי",wrap="לא",rest=5,rub="מלח+פלפל+שום",wood="תפוח",coal="Weber Lump",diff=3,sot=120,soh="4",somid="בישול ארוך לרכות",saved=1.0),
 dict(n=78,cat="איברים פנימיים",heb="כליות בקר",eng="Beef Kidney",kg=0.6,svt=72,svh="1.5",smt=120,smh="0.4",tgt=72,safe=72,sear="כן",mid="השריה בחלב",wrap="לא",rest=5,rub="מלח+פלפל+חרדל",wood="אלון",coal="Weber Lump",diff=3,sot=120,soh="0.5",somid="עד סוף לבטיחות",saved=0.4),
 dict(n=79,cat="איברים פנימיים",heb="כליות טלה",eng="Lamb Kidney",kg=0.4,svt=72,svh="1.5",smt=120,smh="0.4",tgt=72,safe=72,sear="כן",mid="השריה בחלב",wrap="לא",rest=5,rub="מלח+פלפל",wood="דובדבן",coal="Weber Lump",diff=3,sot=120,soh="0.5",somid="עד סוף לבטיחות",saved=0.4),
 dict(n=80,cat="איברים פנימיים",heb="מוח עגל",eng="Veal Brain",kg=0.4,svt=65,svh="1.5",smt=110,smh="0.3",tgt=65,safe=65,sear="עדין",mid="בלאנץ׳",wrap="לא",rest=5,rub="מלח+חמאה חומה+לימון",wood="ללא",coal="Weber Lump",diff=4,sot=110,soh="0.4",somid="בלאנץ׳, מרקם קרמי",saved=0.3),
 # ── ירקות (vegetables) ──
 dict(n=81,cat="ירקות",heb="תירס",eng="Corn on the Cob",kg=0.3,svt=84,svh="0.5",smt=200,smh="0.25",tgt=84,safe=0,sear="גריל ישיר",mid="אין",wrap="קליפה אופ׳",rest=2,rub="חמאת שום/צ׳ילי-ליים+קוטיחה",wood="תפוח/היקורי",coal="Weber Lump",diff=1,sot=200,soh="0.25",somid="סיבוב עד חריכה",saved=0.3),
 dict(n=82,cat="ירקות",heb="פלפל",eng="Bell Pepper",kg=0.2,svt=85,svh="0.75",smt=230,smh="0.15",tgt=85,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=2,rub="שמן זית+מלח גס",wood="תפוח",coal="Weber Lump",diff=1,sot=230,soh="0.15",somid="עד הופעת בועות עור",saved=0.2),
 dict(n=83,cat="ירקות",heb="חציל",eng="Eggplant",kg=0.4,svt=85,svh="0.75",smt=220,smh="0.13",tgt=85,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=3,rub="שמן זית+טחינה/צ׳ימיצ׳ורי",wood="דובדבן",coal="Weber Lump",diff=2,sot=220,soh="0.15",somid="לרכך את הפנים",saved=0.3),
 dict(n=84,cat="ירקות",heb="קישוא",eng="Zucchini",kg=0.2,svt=84,svh="0.33",smt=230,smh="0.1",tgt=84,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=1,rub="שמן זית+שום+פרמזן",wood="תפוח",coal="Weber Lump",diff=1,sot=230,soh="0.1",somid="פרוסות ½ ס\"מ",saved=0.2),
 dict(n=85,cat="ירקות",heb="בצל",eng="Onion",kg=0.2,svt=85,svh="0.5",smt=200,smh="0.15",tgt=85,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=2,rub="שמן+בלסמי",wood="היקורי",coal="Weber Lump",diff=1,sot=200,soh="0.15",somid="פרוסות עבות, לא לפרק",saved=0.2),
 dict(n=86,cat="ירקות",heb="פטריות פורטובלו",eng="Portobello",kg=0.2,svt=85,svh="0.5",smt=220,smh="0.13",tgt=85,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=2,rub="שמן+שום+טימין",wood="אלון",coal="Weber Lump",diff=1,sot=220,soh="0.15",somid="צד גילים תחילה",saved=0.2),
 dict(n=87,cat="ירקות",heb="אספרגוס",eng="Asparagus",kg=0.2,svt=83,svh="0.25",smt=230,smh="0.1",tgt=83,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=1,rub="שמן זית+לימון+פרמזן",wood="תפוח",coal="Weber Lump",diff=1,sot=230,soh="0.1",somid="גבעולים עבים עדיפים",saved=0.2),
 dict(n=88,cat="ירקות",heb="גזר",eng="Carrots",kg=0.3,svt=84,svh="1",smt=200,smh="0.2",tgt=84,safe=0,sear="סו-ויד→גריל",mid="חמאה+תימין בשקית",wrap="לא",rest=2,rub="חמאה+דבש+כמון",wood="דובדבן",coal="Weber Lump",diff=2,sot=200,soh="0.2",somid="סו-ויד 84° ואז צריבה",saved=0.5),
 dict(n=89,cat="ירקות",heb="תפוח אדמה",eng="Potato",kg=0.3,svt=90,svh="1.25",smt=200,smh="0.25",tgt=90,safe=0,sear="סו-ויד→גריל/מעיכה",mid="שמן+מלח בשקית",wrap="לא",rest=3,rub="מלח גס+רוזמרין",wood="היקורי",coal="Weber Lump",diff=2,sot=200,soh="0.3",somid="סו-ויד 90° ואז למעוך ולצרוב",saved=0.8),
 dict(n=90,cat="ירקות",heb="בטטה",eng="Sweet Potato",kg=0.3,svt=88,svh="1",smt=200,smh="0.25",tgt=88,safe=0,sear="סו-ויד→גריל",mid="חמאה+מלח",wrap="לא",rest=3,rub="חמאה+מייפל/צ׳ילי",wood="פקאן",coal="Weber Lump",diff=2,sot=200,soh="0.25",somid="סו-ויד 88° ואז צריבה",saved=0.6),
 dict(n=91,cat="ירקות",heb="סלק",eng="Beets",kg=0.3,svt=90,svh="1.5",smt=180,smh="0.5",tgt=90,safe=0,sear="סו-ויד",mid="שמן+מלח",wrap="לא",rest=5,rub="שמן זית+תפוז+עזים",wood="דובדבן",coal="Weber Lump",diff=2,sot=180,soh="0.5",somid="קוביות ½-1 אינץ׳",saved=0.5),
 dict(n=92,cat="ירקות",heb="כרובית",eng="Cauliflower",kg=0.5,svt=85,svh="0.5",smt=200,smh="0.5",tgt=85,safe=0,sear="גריל/עישון",mid="אין",wrap="לא",rest=3,rub="כורכום+שמן/חרדל",wood="היקורי/תפוח",coal="Weber Lump",diff=2,sot=180,soh="0.75",somid="ראש שלם מעושן מרשים",saved=0.5),
 dict(n=93,cat="ירקות",heb="ברוקולי",eng="Broccoli",kg=0.4,svt=84,svh="0.4",smt=220,smh="0.15",tgt=84,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=2,rub="שמן+שום+צ׳ילי+לימון",wood="תפוח",coal="Weber Lump",diff=1,sot=220,soh="0.2",somid="פרחים בשכבה אחת",saved=0.3),
 dict(n=94,cat="ירקות",heb="כרוב",eng="Cabbage",kg=0.6,svt=85,svh="0.75",smt=180,smh="0.75",tgt=85,safe=0,sear="גריל/עישון",mid="אין",wrap="לא",rest=3,rub="חמאה+שום+פפריקה",wood="היקורי",coal="Weber Lump",diff=2,sot=180,soh="1",somid="פרוס ל'סטייקים' עבים",saved=0.5),
 dict(n=95,cat="ירקות",heb="עגבניות",eng="Tomatoes",kg=0.3,svt=85,svh="0.25",smt=220,smh="0.1",tgt=85,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=1,rub="שמן זית+מלח+בזיליקום",wood="תפוח",coal="Weber Lump",diff=1,sot=220,soh="0.1",somid="חצויות, צד חתך תחילה",saved=0.2),
 dict(n=96,cat="ירקות",heb="שעועית ירוקה",eng="Green Beans",kg=0.3,svt=84,svh="0.5",smt=230,smh="0.1",tgt=84,safe=0,sear="סו-ויד/גריל",mid="שמן+שום",wrap="לא",rest=1,rub="שמן+שום+שקדים",wood="תפוח",coal="Weber Lump",diff=1,sot=230,soh="0.1",somid="בסלסלת גריל",saved=0.3),
 dict(n=101,cat="ירקות",heb="ארטישוק",eng="Artichoke",kg=0.4,svt=85,svh="2",smt=200,smh="0.15",tgt=85,safe=0,sear="הרתחה/אידוי→גריל",mid="בלאנץ׳ 25 דק׳",wrap="לא",rest=3,rub="שמן+שום+לימון+פטרוזיליה",wood="אלון/תפוח",coal="Weber Lump",diff=3,sot=100,soh="0.75",somid="חצוי, חתך כלפי מטה",saved=0.6),
 dict(n=102,cat="ירקות",heb="שום שלם מעושן",eng="Whole Smoked Garlic",kg=0.1,svt=85,svh="0.5",smt=100,smh="1",tgt=85,safe=0,sear="עישון",mid="אין",wrap="עטוף בנייר כסף",rest=5,rub="שמן זית+מלח",wood="תפוח/דובדבן",coal="Weber Lump",diff=1,sot=110,soh="2",somid="עד רך וזהוב, ממרח מדהים",saved=0.5),
 dict(n=103,cat="ירקות",heb="חסה רומאית",eng="Romaine Hearts",kg=0.2,svt=85,svh="0.1",smt=250,smh="0.05",tgt=85,safe=0,sear="גריל ישיר מהיר",mid="אין",wrap="לא",rest=0,rub="שמן+פרמזן+אנשובי",wood="ללא",coal="Weber Lump",diff=1,sot=250,soh="0.05",somid="חצוי, חם וזריז לצ׳אר",saved=0.1),
 dict(n=104,cat="ירקות",heb="אבוקדו מעושן",eng="Grilled Avocado",kg=0.2,svt=85,svh="0.1",smt=200,smh="0.1",tgt=85,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=0,rub="ליים+מלח+כוסברה",wood="תפוח",coal="Weber Lump",diff=1,sot=200,soh="0.1",somid="חצוי, צד חתך על הגריל",saved=0.1),
 dict(n=105,cat="ירקות",heb="חלומי",eng="Grilled Halloumi",kg=0.2,svt=85,svh="0.1",smt=230,smh="0.05",tgt=85,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=0,rub="שמן+נענע/רוזמרין+דבש",wood="ללא",coal="Weber Lump",diff=1,sot=230,soh="0.05",somid="לא נמס, מזהיב יפה",saved=0.1),
 # ── פירות (fruits) ──
 dict(n=97,cat="פירות",heb="אננס",eng="Pineapple",kg=0.4,svt=70,svh="0.5",smt=230,smh="0.1",tgt=70,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=1,rub="דבש/רום/צ׳ילי",wood="תפוח",coal="Weber Lump",diff=1,sot=230,soh="0.1",somid="פרוסות, קרמול הסוכר",saved=0.2),
 dict(n=98,cat="פירות",heb="אפרסק",eng="Peach",kg=0.2,svt=73,svh="0.4",smt=220,smh="0.1",tgt=73,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=1,rub="חמאה+דבש+קינמון",wood="דובדבן/תפוח",coal="Weber Lump",diff=1,sot=220,soh="0.1",somid="חצוי, צד חתך תחילה",saved=0.2),
 dict(n=99,cat="פירות",heb="אגס",eng="Pear",kg=0.2,svt=73,svh="0.5",smt=200,smh="0.1",tgt=73,safe=0,sear="סו-ויד/גריל",mid="חמאה+וניל",wrap="לא",rest=1,rub="חמאה+יין אדום/דבש",wood="דובדבן",coal="Weber Lump",diff=1,sot=200,soh="0.1",somid="חצוי או פרוס",saved=0.2),
 dict(n=100,cat="פירות",heb="בננה",eng="Banana",kg=0.2,svt=73,svh="0.25",smt=200,smh="0.1",tgt=73,safe=0,sear="גריל בקליפה",mid="אין",wrap="קליפה",rest=1,rub="שוקולד/דבש/קינמון",wood="ללא",coal="Weber Lump",diff=1,sot=200,soh="0.1",somid="חתך לאורך, ממלאים",saved=0.1),
 dict(n=106,cat="פירות",heb="אבטיח מעושן",eng="Grilled Watermelon",kg=0.5,svt=85,svh="0.1",smt=230,smh="0.1",tgt=85,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=1,rub="דבש+נענע+ליים/מלח",wood="תפוח",coal="Weber Lump",diff=1,sot=230,soh="0.1",somid="פרוסות עבות, מרקם 'בשרי'",saved=0.2),
 dict(n=107,cat="פירות",heb="תאנים",eng="Grilled Figs",kg=0.2,svt=73,svh="0.2",smt=220,smh="0.08",tgt=73,safe=0,sear="גריל ישיר",mid="אין",wrap="לא",rest=1,rub="דבש+בלסמי+גבינת עזים",wood="דובדבן",coal="Weber Lump",diff=1,sot=220,soh="0.08",somid="חצויות, קצר וחם",saved=0.1),
 dict(n=108,cat="בקר",heb="נתח קצבים",eng="Hanger / Onglet",kg=0.9,svt=54,svh="1.5-2",smt=110,smh="0.4",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=8,rub="מלח+פלפל / מרינדת סויה-שום",wood="אלון/היקורי",coal="Fogo Premium",diff=2,sot=110,soh="0.5",somid="גריל בלבד — לא לעישון ארוך",saved=1.1,doneness=dict(default="mr",levels=dict(rare=dict(c=50),mr=dict(c=54),med=dict(c=58),mw=dict(c=62),well=dict(c=66)))),
 dict(n=109,cat="בקר",heb="סקירט",eng="Skirt",kg=0.7,svt=54,svh="1-1.5",smt=110,smh="0.3",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=6,rub="מרינדת סויה-שום-צ'ילי-ליים",wood="אלון",coal="Fogo Premium",diff=2,sot=110,soh="0.4",somid="גריל חזק ומהיר בלבד",saved=0.9,doneness=dict(default="mr",levels=dict(rare=dict(c=50),mr=dict(c=54),med=dict(c=58),mw=dict(c=62),well=dict(c=66)))),
 dict(n=110,cat="בקר",heb="פלאנק",eng="Flank",kg=1.0,svt=54,svh="2",smt=110,smh="0.4",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=8,rub="מרינדה / מלח-פלפל-שום",wood="היקורי/אלון",coal="Kamado Joe",diff=2,sot=110,soh="0.5",somid="גריל חזק, פריסה דקה נגד הסיבים",saved=1.2,doneness=dict(default="mr",levels=dict(rare=dict(c=50),mr=dict(c=54),med=dict(c=58),mw=dict(c=62),well=dict(c=66)))),
 dict(n=111,cat="בקר",heb="דנוור",eng="Denver",kg=0.8,svt=54,svh="2-3",smt=110,smh="0.5",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=8,rub="מלח גס+פלפל",wood="דובדבן/היקורי",coal="Kamado Joe",diff=2,sot=115,soh="1",somid="הפיכה",saved=1.0,doneness=dict(default="mr",levels=dict(rare=dict(c=50),mr=dict(c=54),med=dict(c=60),mw=dict(c=64),well=dict(c=68)))),
 dict(n=112,cat="בקר",heb="פלאט איירון",eng="Flat Iron",kg=0.7,svt=54,svh="2",smt=110,smh="0.4",tgt=54,safe=63,sear="כן",mid="צינון",wrap="לא",rest=8,rub="מלח+פלפל+שום",wood="דובדבן/אלון",coal="Kamado Joe",diff=2,sot=115,soh="1",somid="הפיכה — הסירו גיד מרכזי",saved=0.9,doneness=dict(default="mr",levels=dict(rare=dict(c=50),mr=dict(c=54),med=dict(c=60),mw=dict(c=64),well=dict(c=68)))),
 dict(n=113,cat="פירות ים",heb="שרימפס ג'מבו",eng="Jumbo Shrimp",kg=0.5,svt=57,svh="0.5",smt=230,smh="0.1",tgt=63,safe=63,sear="גריל ישיר",mid="אין",wrap="לא",rest=2,rub="שום+חמאה+לימון/פפריקה",wood="תפוח/אלון",coal="Weber Lump",diff=1,sot=230,soh="0.1",somid="על שיפוד, 1-2 דק'/צד",saved=0.42,doneness={'default': 'med', 'levels': {'mr': {'c': 52}, 'med': {'c': 60}, 'well': {'c': 66}}}),
 dict(n=114,cat="פירות ים",heb="שרימפס טייגר",eng="Black Tiger Shrimp",kg=0.5,svt=57,svh="0.5",smt=230,smh="0.1",tgt=63,safe=63,sear="גריל ישיר",mid="אין",wrap="לא",rest=2,rub="צ'ילי+שום+כוסברה",wood="תפוח/אלון",coal="Weber Lump",diff=1,sot=230,soh="0.1",somid="בקליפה לעסיסיות",saved=0.42,doneness={'default': 'med', 'levels': {'mr': {'c': 52}, 'med': {'c': 60}, 'well': {'c': 66}}}),
 dict(n=115,cat="פירות ים",heb="גמברי / חסילון ענק",eng="Giant Prawns",kg=0.6,svt=54,svh="0.75",smt=230,smh="0.12",tgt=63,safe=63,sear="גריל ישיר",mid="אין",wrap="לא",rest=2,rub="שמן זית+שום+פטרוזיליה",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=230,soh="0.12",somid="חצוי לאורך, בשר-למטה",saved=0.51,doneness={'default': 'med', 'levels': {'mr': {'c': 52}, 'med': {'c': 60}, 'well': {'c': 66}}}),
 dict(n=116,cat="פירות ים",heb="סקלופס",eng="Sea Scallops",kg=0.4,svt=50,svh="0.5",smt=240,smh="0.08",tgt=54,safe=63,sear="צריבה",mid="אין",wrap="לא",rest=1,rub="מלח+חמאה חומה",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=240,soh="0.08",somid="יבשים! 2-3 דק'/צד, אל תזיז",saved=0.34,doneness={'default': 'mr', 'levels': {'rare': {'c': 49}, 'mr': {'c': 52}, 'med': {'c': 57}, 'well': {'c': 63}}}),
 dict(n=117,cat="פירות ים",heb="זנב לובסטר",eng="Lobster Tail",kg=0.5,svt=54,svh="0.75",smt=230,smh="0.17",tgt=60,safe=63,sear="גריל בשר-למטה",mid="אין",wrap="לא",rest=3,rub="חמאת שום+לימון",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=230,soh="0.17",somid="חצוי, בשר-למטה 5 דק' ואז קליפה-למטה",saved=0.42,doneness={'default': 'med', 'levels': {'mr': {'c': 52}, 'med': {'c': 60}, 'well': {'c': 66}}}),
 dict(n=118,cat="פירות ים",heb="לובסטר שלם",eng="Whole Lobster",kg=0.7,svt=60,svh="0.75",smt=220,smh="0.2",tgt=60,safe=63,sear="גריל/הרתחה",mid="אין",wrap="לא",rest=3,rub="חמאה+עשבי תיבול",wood="תפוח/אלון",coal="Weber Lump",diff=3,sot=220,soh="0.2",somid="חצוי לאורך; מוכן כשאדום ואטום",saved=0.59,doneness={'default': 'med', 'levels': {'mr': {'c': 52}, 'med': {'c': 60}, 'well': {'c': 66}}}),
 dict(n=119,cat="פירות ים",heb="לנגוסטין",eng="Langoustine",kg=0.4,svt=50,svh="0.5",smt=230,smh="0.1",tgt=60,safe=63,sear="גריל ישיר",mid="אין",wrap="לא",rest=2,rub="שמן זית+שום+צ'ילי",wood="תפוח/אלון",coal="Weber Lump",diff=3,sot=230,soh="0.1",somid="חצוי, גריל מהיר",saved=0.34,doneness={'default': 'med', 'levels': {'mr': {'c': 52}, 'med': {'c': 60}, 'well': {'c': 66}}}),
 dict(n=120,cat="פירות ים",heb="סרטן כחול",eng="Blue Crab",kg=0.6,svt=0,svh="0",smt=210,smh="0.25",tgt=60,safe=63,sear="הרתחה/אידוי",mid="אין",wrap="לא",rest=2,rub="Old Bay/פפריקה",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=210,soh="0.25",somid="מוכן כשהקליפה אדומה בוהקת",saved=0.51,doneness={'default': 'med', 'levels': {'med': {'c': 63}, 'well': {'c': 68}}}),
 dict(n=121,cat="פירות ים",heb="רגלי סרטן מלך",eng="King Crab Legs",kg=0.8,svt=0,svh="0",smt=210,smh="0.15",tgt=60,safe=63,sear="גריל/אידוי",mid="אין",wrap="לא",rest=1,rub="חמאה מומסת+שום",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=210,soh="0.15",somid="כבר מבושלות בד״כ — רק לחמם 5 דק'",saved=0.68,doneness={'default': 'med', 'levels': {'med': {'c': 63}, 'well': {'c': 68}}}),
 dict(n=122,cat="פירות ים",heb="סרטן רך",eng="Soft-Shell Crab",kg=0.3,svt=0,svh="0",smt=230,smh="0.12",tgt=63,safe=63,sear="צריבה/טיגון",mid="אין",wrap="לא",rest=3,rub="קמח+פפריקה (טיגון) / חמאה",wood="תפוח/אלון",coal="Weber Lump",diff=3,sot=230,soh="0.12",somid="אוכלים שלם! פריך מבחוץ",saved=0.26,doneness={'default': 'well', 'levels': {'med': {'c': 60}, 'well': {'c': 66}}}),
 dict(n=123,cat="פירות ים",heb="תמנון",eng="Octopus",kg=1.0,svt=77,svh="5",smt=240,smh="0.17",tgt=75,safe=63,sear="הרתחה→גריל",mid="אין",wrap="לא",rest=3,rub="שמן זית+לימון+אורגנו",wood="אלון/גפן",coal="Kamado Joe",diff=4,sot=240,soh="0.17",somid="בשל 45-60 דק' לריכוך ואז חריכה",saved=0.85,doneness={'default': 'well', 'levels': {'med': {'c': 71}, 'well': {'c': 77}}}),
 dict(n=124,cat="פירות ים",heb="קלמרי / דיונון",eng="Squid / Calamari",kg=0.5,svt=59,svh="2",smt=250,smh="0.05",tgt=63,safe=63,sear="גריל חזק ומהיר",mid="אין",wrap="לא",rest=1,rub="שמן זית+שום+לימון",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=250,soh="0.05",somid="30-60 שנ'/צד — יותר=גומי",saved=0.42,doneness={'default': 'med', 'levels': {'med': {'c': 60}, 'well': {'c': 66}}}),
 dict(n=125,cat="דג",heb="סטייק טונה",eng="Tuna Steak",kg=0.4,svt=45,svh="0.5",smt=250,smh="0.05",tgt=45,safe=63,sear="צריבה MR",mid="אין",wrap="לא",rest=1,rub="שומשום+סויה+ג'ינג'ר",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=250,soh="0.05",somid="סושי-גרייד; מרכז נא, 1-2 דק'/צד",saved=0.34,doneness={'default': 'med', 'scale': 'fish', 'levels': {'mr': {'c': 42}, 'med': {'c': 48}, 'well': {'c': 54}}}),
 dict(n=126,cat="דג",heb="דג חרב",eng="Swordfish Steak",kg=0.5,svt=54,svh="0.75",smt=230,smh="0.1",tgt=60,safe=63,sear="גריל ישיר",mid="אין",wrap="לא",rest=2,rub="שמן זית+לימון+אורגנו",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=230,soh="0.1",somid="סטייק מוצק, קרוסהאץ'",saved=0.42,doneness={'default': 'med', 'scale': 'fish', 'levels': {'mr': {'c': 52}, 'med': {'c': 58}, 'well': {'c': 64}}}),
 dict(n=127,cat="דג",heb="הליבוט",eng="Halibut",kg=0.5,svt=52,svh="0.5",smt=210,smh="0.12",tgt=58,safe=63,sear="גריל/צלייה",mid="אין",wrap="לא",rest=3,rub="חמאה+עשבי תיבול",wood="תפוח/אלון",coal="Weber Lump",diff=2,sot=210,soh="0.12",somid="לבן ומוצק — עדין, לא לייבש",saved=0.42,doneness={'default': 'med', 'scale': 'fish', 'levels': {'mr': {'c': 52}, 'med': {'c': 56}, 'well': {'c': 60}}}),
 dict(n=128,cat="פירות ים",heb="מולים",eng="Mussels",kg=1.0,svt=0,svh="0",smt=230,smh="0.1",tgt=63,safe=63,sear="גריל/אידוי",mid="אין",wrap="לא",rest=1,rub="יין לבן+שום+שמנת",wood="תפוח/אלון",coal="Weber Lump",diff=1,sot=230,soh="0.1",somid="מוכנות כשנפתחות (~5 דק'); זרוק סגורות",saved=0.85,doneness={'default': 'med', 'levels': {'med': {'c': 63}, 'well': {'c': 68}}}),
 dict(n=129,cat="פירות ים",heb="צדפות (קלאמס)",eng="Clams",kg=1.0,svt=0,svh="0",smt=230,smh="0.1",tgt=63,safe=63,sear="גריל/אידוי",mid="אין",wrap="לא",rest=1,rub="יין+שום+פטרוזיליה",wood="תפוח/אלון",coal="Weber Lump",diff=1,sot=230,soh="0.1",somid="עד שנפתחות 5-7 דק'",saved=0.85,doneness={'default': 'med', 'levels': {'med': {'c': 63}, 'well': {'c': 68}}}),
 dict(n=130,cat="פירות ים",heb="אויסטרים",eng="Oysters",kg=0.5,svt=0,svh="0",smt=240,smh="0.1",tgt=63,safe=63,sear="גריל קמור-למטה",mid="אין",wrap="לא",rest=1,rub="חמאת שום/מיניונט",wood="אלון",coal="Weber Lump",diff=2,sot=240,soh="0.1",somid="קמור-למטה, עד שנפתחות 5-10 דק'",saved=0.42,doneness={'default': 'med', 'levels': {'med': {'c': 63}, 'well': {'c': 68}}}),
]

# Specials (cured / smoked / dried). keys: n,cat,heb,eng,cure,smt,smh,tgt,age,wood,diff,note
SPECIALS = [
 dict(n=1,cat="בשר מיובש",heb="ג'רקי בקר",eng="Beef Jerky",cure="מרינדת סויה+תיבול (אופ' Cure #1)",smt=70,smh="4-6",tgt="עד מרקם יבש-גמיש",age="—",wood="היקורי/מזקיט",diff=2,note="לפרוס 5 מ\"מ נגד הסיבים; מוכן כשמתכופף ונסדק ולא נשבר."),
 dict(n=2,cat="בשר מיובש",heb="ג'רקי הודו",eng="Turkey Jerky",cure="מרינדה דלת שומן (מומלץ Cure #1)",smt=70,smh="4-5",tgt="74°C ואז יבש",age="—",wood="תפוח/דובדבן",diff=2,note="להקפיד על 74°C לבטיחות לפני ייבוש."),
 dict(n=3,cat="בשר מיובש",heb="בילטונג",eng="Biltong",cure="חומץ+מלח+כוסברה+פלפל",smt=None,smh="ללא עישון",tgt="—",age="4-7 ימים בייבוש מאוורר בטמפ׳ חדר",wood="ללא",diff=3,note="ייבוש אוויר בטמפ׳ חדר נעימה (~21–27°C) ולחות 50–60%, ללא עישון — זרימת אוויר חיונית; החומץ מחטא ו'מבשל' כימית."),
 dict(n=4,cat="בייקון",heb="בייקון חזיר",eng="Pork Bacon",cure="כבישה יבשה Cure #1 + סוכר, ~7 ימים",smt=90,smh="3-4",tgt=65,age="—",wood="היקורי/תפוח",diff=3,note="לאחר עישון לקרר היטב, לפרוס ולטגן לפני אכילה."),
 dict(n=5,cat="בייקון",heb="בייקון בקר",eng="Beef Bacon",cure="כבישה Cure #1, ~7 ימים",smt=90,smh="3",tgt=65,age="—",wood="היקורי/אלון",diff=3,note="מבטן/נאבל בקר; לפרוס דק."),
 dict(n=6,cat="נקניק מעושן",heb="קילבסה",eng="Kielbasa",cure="Cure #1 בבשר טחון",smt=68,smh="3-4",tgt=68,age="—",wood="אלון/בכר/תפוח",diff=3,note="נקניק פולני מבושל-מעושן; אפשר להגיש מיד. עישון מדורג 60→75°C."),
 dict(n=7,cat="נקניק מעושן",heb="אנדוי",eng="Andouille",cure="תיבול קייג'ן + Cure #1",smt=70,smh="4",tgt=68,age="—",wood="פקאן/היקורי",diff=3,note="חריף ומעושן בכבדות; קלאסי לגמבו."),
 dict(n=8,cat="נקניק מעושן",heb="סרוולט",eng="Cervelat",cure="Cure #1",smt=60,smh="2-3",tgt=68,age="ייבוש קצר (אופציונלי)",wood="בכר/אלון",diff=3,note="נקניק חצי-יבש שוויצרי/גרמני. עישון 50→60°C."),
 dict(n=9,cat="נקניק מעושן",heb="סאמר סוסג'",eng="Summer Sausage",cure="תרבית התססה + Cure #1",smt=68,smh="4-6",tgt=68,age="—",wood="היקורי/אלון",diff=4,note="טעם חמצמץ (טאנג) מההתססה; חצי-יבש. עישון מדורג 50→75°C."),
 dict(n=10,cat="נקניק מיובש",heb="קבנוס",eng="Kabanos",cure="תרבית התססה + Cure #2",smt=50,smh="2-3",tgt="—",age="5-10 ימים (ירידה 30-35%)",wood="בכר/אלון/שזיף",diff=4,note="נקניק חזיר דק ויבש; פרוסות דקות לנשנוש. עישון קר-פושר."),
 dict(n=11,cat="נקניק מיובש",heb="סלמי",eng="Salami",cure="תרבית + מלח + Cure #2",smt=None,smh="עישון קר אופציונלי 12-24h",tgt="—",age="3-6 שבועות (ירידה 30-40%)",wood="בכר",diff=5,note="בקרת טמפ'/לחות קריטית לבטיחות; דורש ניסיון."),
 dict(n=12,cat="נקניק מיובש",heb="צ'וריסו מיובש",eng="Dry Chorizo",cure="פפריקה מעושנת + שום + Cure #2",smt=None,smh="עישון קר אופציונלי",tgt="—",age="3-5 שבועות",wood="אלון",diff=5,note="ספרדי; הפפריקה נותנת צבע וטעם אופייניים."),
 dict(n=13,cat="נקניק מיובש",heb="לנדיגר",eng="Landjäger",cure="תרבית + Cure #2",smt=50,smh="6-12",tgt="—",age="1-2 שבועות (שטוח, בלחיצה)",wood="בכר",diff=4,note="נקניק חצי-יבש דרום-גרמני; מיובש בלחיצה. עישון קר."),
 dict(n=14,cat="נקניק מיובש",heb="פפרוני",eng="Pepperoni",cure="פפריקה+צ'ילי + תרבית + Cure #2",smt=None,smh="עישון קר אופציונלי",tgt="—",age="3-4 שבועות",wood="אלון/ללא",diff=5,note="מיובש-מותסס; קלאסי לפיצה."),
 dict(n=15,cat="גבינה",heb="גאודה מעושנת",eng="Smoked Gouda",cure="—",smt=30,smh="2-4",tgt="—",age="איטום וקירור 1-2 שבועות",wood="תפוח/אלון/דובדבן",diff=2,note="עישון קר חובה (≤30°C) למניעת המסה; מחולל עשן (tube/maze)."),
 dict(n=16,cat="גבינה",heb="צ'דר מעושן",eng="Smoked Cheddar",cure="—",smt=30,smh="2-4",tgt="—",age="מנוחה 1-2 שבועות",wood="היקורי/תפוח",diff=2,note="להתמתנות הטעם — לא לאכול מיד אחרי העישון."),
 dict(n=17,cat="גבינה",heb="סקמורצה/מוצרלה מעושנת",eng="Smoked Scamorza",cure="—",smt=28,smh="1-2",tgt="—",age="מיידי-קצר",wood="אלון/תפוח",diff=2,note="רכה — עישון קצר ובטמפ' נמוכה מאוד (≤28°C)."),
 dict(n=18,cat="גבינה",heb="פרובולון מעושן",eng="Smoked Provolone",cure="—",smt=30,smh="2-3",tgt="—",age="מנוחה ~שבוע",wood="אלון/דובדבן",diff=2,note="קשה-בינונית; סופגת עשן יפה."),
 dict(n=19,cat="גבינה",heb="גבינת שמנת מעושנת",eng="Smoked Cream Cheese",cure="ציפוי ראב (חם, קצר)",smt=110,smh="1.5-2",tgt="—",age="—",wood="תפוח/דובדבן",diff=1,note="טרנד BBQ — מעשנים חם עם ראב; מגישים כמטבל."),
 dict(n=20,cat="גבינה",heb="צ'דר מיושן",eng="Aged Cheddar",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2-3",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="היקורי/תפוח",diff=2,note="מיושן — טעם חזק ואגוזי שסופג עשן לעומק."),
 dict(n=21,cat="גבינה",heb="גאודה",eng="Gouda",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="דובדבן/תפוח",diff=1,note="אולי הגבינה האהובה לעישון — נהיית אגוזית-קרמלית."),
 dict(n=22,cat="גבינה",heb="גאודה מיושנת",eng="Aged Gouda",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2-3",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="דובדבן/אלון",diff=2,note="מרקם גבישי, טעם מרוכז ומתקתק."),
 dict(n=23,cat="גבינה",heb="גרוייר",eng="Gruyère",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="תפוח/אלון",diff=2,note="מתוק-אדמתי; נמס מצוין על בורגר."),
 dict(n=24,cat="גבינה",heb="קומטה",eng="Comté",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2-3",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="אלון/תפוח",diff=2,note="קרוב לגרוייר, מורכב ואגוזי."),
 dict(n=25,cat="גבינה",heb="אמנטל",eng="Emmental",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="תפוח/מייפל",diff=2,note="החורים הקלאסיים; חמצמץ-אגוזי."),
 dict(n=26,cat="גבינה",heb="מנצ'גו",eng="Manchego",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="אלון/דובדבן",diff=2,note="כבשים ספרדי; חמאתי עם קצה פלפלי."),
 dict(n=27,cat="גבינה",heb="אדם",eng="Edam",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="1.5-2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="תפוח",diff=1,note="מתון-אגוזי; הסר את הקליפה האדומה לפני."),
 dict(n=28,cat="גבינה",heb="קולבי ג'ק",eng="Colby Jack",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="היקורי/תפוח",diff=1,note="קרמי ומתון; שיש כתום-לבן."),
 dict(n=29,cat="גבינה",heb="מונטריי ג'ק",eng="Monterey Jack",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="תפוח/דובדבן",diff=1,note="מתון ונמס — מושלם לבורגר וקסדייה."),
 dict(n=30,cat="גבינה",heb="פפר ג'ק",eng="Pepper Jack",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="היקורי",diff=1,note="מונטריי ג'ק עם צ'ילי — חריף לצ'יזבורגר."),
 dict(n=31,cat="גבינה",heb="הוורטי",eng="Havarti",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="1.5",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="תפוח",diff=1,note="חצי-רך קרמי; עישון עדין וקצר."),
 dict(n=32,cat="גבינה",heb="אסיאגו",eng="Asiago",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="אלון/היקורי",diff=2,note="חצי-מתוק (טרי) עד חד (מיושן)."),
 dict(n=33,cat="גבינה",heb="פרמז'ן",eng="Parmigiano",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2-3",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="אלון",diff=2,note="קשה לגירוד; עשן עדין מוסיף עומק."),
 dict(n=34,cat="גבינה",heb="רקלט",eng="Raclette",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="1.5-2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="תפוח/דובדבן",diff=2,note="נמס מצוין — לתפו״א, חמוצים ובשר."),
 dict(n=35,cat="גבינה",heb="פונטינה",eng="Fontina",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="1.5-2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="אלון/תפוח",diff=2,note="קרמי-אגוזי איטלקי; נמס יפה בפונדו."),
 dict(n=36,cat="גבינה",heb="טילסיט",eng="Tilsit",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="מייפל/אלון",diff=2,note="חצי-קשה עם ארומה חריפה."),
 dict(n=37,cat="גבינה",heb="ז'רלסברג",eng="Jarlsberg",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="תפוח",diff=1,note="נורווגי אגוזי-מתוק עם חורים."),
 dict(n=38,cat="גבינה",heb="קנטל",eng="Cantal",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2-3",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="אלון/דובדבן",diff=2,note="צרפתי מוצק, בין צ'דר לפרמז'ן."),
 dict(n=39,cat="גבינה",heb="גבינה כחולה",eng="Blue Cheese",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="דובדבן/אגוזי-לוז",diff=3,note="חד וקרמי; העשן מאזן את המליחות."),
 dict(n=40,cat="גבינה",heb="אורגון בלו",eng="Oregon Blue",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="3",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="קליפות אגוזי-לוז",diff=3,note="הכחולה המעושנת הראשונה בעולם (Rogue)."),
 dict(n=41,cat="גבינה",heb="גורגונזולה",eng="Gorgonzola",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="דובדבן",diff=3,note="כחולה איטלקית קרמית; עישון עדין."),
 dict(n=42,cat="גבינה",heb="סטילטון",eng="Stilton",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="אלון/אגוז",diff=3,note="כחולה אנגלית אצילית ועשירה."),
 dict(n=43,cat="גבינה",heb="רוקפור",eng="Roquefort",cure="ייבוש לילה במקרר, לחדר לפני",smt=28,smh="1.5-2",tgt="—",age="יישון 2+ שבועות במקרר (טרי = טעם פחם)",wood="דובדבן",diff=3,note="כחולת כבשים צרפתית; מלוחה-חדה, עישון קצר."),
 dict(n=44,cat="גבינה",heb="פיור די לטה מעושן",eng="Smoked Fior di Latte",cure="ייבוש לילה במקרר, לחדר לפני",smt=25,smh="1-1.5",tgt="—",age="מיידי-קצר",wood="אלון/תפוח",diff=2,note="מוצרלת חלב פרה; עישון קצר בטמפ' נמוכה."),
 dict(n=45,cat="גבינה",heb="ברי",eng="Brie",cure="ייבוש לילה במקרר, לחדר לפני",smt=25,smh="0.5-1",tgt="—",age="מיידי",wood="תפוח/דובדבן",diff=2,note="רכה — עטוף בנייר כסף ועשן עדין וקצר."),
 dict(n=46,cat="גבינה",heb="קממבר",eng="Camembert",cure="ייבוש לילה במקרר, לחדר לפני",smt=25,smh="0.5-1",tgt="—",age="מיידי",wood="תפוח",diff=2,note="כמו ברי — עדין, בעטיפה, השגחה צמודה."),
 dict(n=47,cat="גבינה",heb="חלומי",eng="Halloumi",cure="—",smt="",smh="גריל ישיר 2-3 דק'/צד",tgt="—",age="מיידי",wood="פחם/גריל",diff=1,note="גבינת הגריל — נקודת התכה גבוהה, לא נמסה. סטייק גבינה על האש."),
]

GLOSSARY = [
 ("בישול","סו-ויד","Sous-Vide","בישול בשקית אטומה בוואקום באמבט מים בטמפ' מדויקת וקבועה לאורך זמן; מבטיח בישול אחיד מקצה לקצה."),
 ("בישול","צריבה","Sear","צריבה קצרה בטמפ' גבוהה מאוד ליצירת קרום וטעם (תגובת מייאר)."),
 ("בישול","ריוורס סיר","Reverse Sear","בישול איטי בטמפ' נמוכה עד קרוב ליעד, ואז צריבה חזקה בסוף."),
 ("בישול","טמפ' יעד (מרקם)","Target Temp","הטמפ' הפנימית הרצויה לטעם/מרקם — נתח רך ~54-57°, נתחי קולגן ~90-96°. לא בהכרח טמפ' הבטיחות."),
 ("בישול","טמפ' בטיחות","Safe Min Temp","מינימום פנימי (USDA) להריגת פתוגנים: עוף 74°, טחון 71°, דג ונתח שלם 63°."),
 ("עישון","שיטת 3-2-1","3-2-1 Method","לצלעות חזיר: 3 שעות עישון גלוי, 2 שעות עטוף בנייר כסף עם נוזל, 1 שעה גלוי עם רוטב/גלייז."),
 ("עישון","עטיפה (Texas Crutch)","Wrap","עטיפת הבשר בנייר כסף או נייר קצבים בשלב מסוים כדי לעבור מהר את ה'סטָאל' ולשמר לחות."),
 ("עישון","ה'סטָאל'","The Stall","עצירת עליית הטמפ' הפנימית סביב 65-70° עקב אידוי משטח; העטיפה מקצרת אותה."),
 ("עישון","עישון קר","Cold Smoke","עישון בטמפ' ≤30° ללא בישול — לגבינות, דגים ונקניקים מיובשים. דורש מחולל עשן."),
 ("עישון","עישון חם","Hot Smoke","עישון שמבשל ומעשן בו-זמנית (~90-150°)."),
 ("עישון","גלייז","Glaze","מריחת ציפוי מתוק/דביק בסוף הבישול לברק וטעם."),
 ("עישון","מריחה / ריסוס","Mop / Spritz","ריסוס או מריחת נוזל (מיץ תפוחים, חומץ) לשמירת לחות וצבע."),
 ("עישון","ייבוש עור / Pellicle","Pellicle / Drying","ייבוש פני השטח/העור — לעור פריך בעוף, או למשטח דביק (pellicle) שסופג עשן בדגים."),
 ("עישון","צינון","Hold / Chill","קירור או החזקה לפני או אחרי שלב בישול."),
 ("עישון","קרום","Bark","הקרום הכהה והמתובל שנוצר על פני הבשר בעישון ממושך."),
 ("ריפוי","Cure #1","Prague Powder #1","ניטריט נתרן (6.25%)+מלח, 'מלח ורוד'; למוצרים מבושלים/מעושנים קצר. מונע בוטוליזם ושומר צבע."),
 ("ריפוי","Cure #2","Prague Powder #2","ניטריט+ניטראט; למוצרים מיובשים ארוכים שאינם מבושלים — משחרר חנקה לאט לאורך ההבשלה."),
 ("ריפוי","כבישה יבשה","Dry Cure","שפשוף תערובת מלח/ריפוי ישירות על הבשר וייבוש מבוקר במקרר."),
 ("ריפוי","תרבית התססה","Starter Culture","חיידקי חומצת חלב להחמצה, טעם ובטיחות בנקניקים מותססים."),
 ("ריפוי","גרבלקס","Gravlax","כבישת דג (סלמון) במלח+סוכר+שמיר, ללא עישון או בישול."),
 ("עץ","אלון","Oak","עשן מאוזן ובסיסי; מתאים לבקר ולרוב הנתחים."),
 ("עץ","היקורי","Hickory","עשן חזק 'בייקוני'; מצוין לחזיר ובקר, במידה."),
 ("עץ","מזקיט","Mesquite","עשן חזק מאוד ועפיץ; לבישול קצר ולבקר."),
 ("עץ","פקאן","Pecan","מתון-מתוק, ביניים בין היקורי לעצי פרי."),
 ("עץ","תפוח","Apple","מתוק ועדין; לעוף, חזיר ודגים."),
 ("עץ","דובדבן","Cherry","מתוק; נותן צבע אדמדם יפה."),
 ("עץ","בכר","Beech","עדין; נפוץ לנקניקים מעושנים."),
 ("פחם","פחם גוש","Lump Charcoal","פחם עץ טבעי לבעירה נקייה וחמה, לעומת בריקטים."),
 ("פחם","Fogo Super Premium","Fogo Super Premium","פחם גוש איכותי לבעירה ארוכה ויציבה — לבישולים ממושכים."),
 ("פחם","Weber Lump","Weber Lump","פחם גוש לחימום מהיר ובישולים קצרים-בינוניים."),
 ("פחם","Kamado Joe","Kamado Joe","פחם גוש לחום גבוה וצריבה (מתאים לתנורי קמאדו)."),
 ("ציוד","מחולל עשן","Tube / Maze Smoke","מילוי בפלטים/נסורת שמעשן זמן רב כמעט ללא חום — לעישון קר."),
 ("ציוד","מעשנת ארון","Cabinet Smoker","מעשנת אנכית עם תאים/מדפים, נפוצה על פחם; שומרת חום יציב לאורך זמן."),
 ("מדד","רמת קושי","Difficulty","סולם 1 (קל מאוד) עד 5 (מתקדם/דורש בקרה וניסיון)."),
 ("מדד","זמן מעשנת שנחסך","Smoker Time Saved","כמה זמן פעיל ליד המעשנת חוסכת שיטת הסו-ויד מול עישון בלבד."),
 ("בטיחות","פסטור (זמן×טמפ׳)","Pasteurization","בסו-ויד הבטיחות מושגת מצירוף טמפרטורה וזמן, לא מטמפ׳ בלבד. הזמן נמדד מהרגע שמרכז הנתח מגיע לטמפ׳ האמבט (לא מהכנסת השקית); מומלץ מרווח ~20%. לדוגמה: עוף ב-60°C דורש ~25 דק׳ בליבה; ב-65°C — דקה."),
 ("בטיחות","כלל 4 השעות","4-Hour Rule","אין להחזיק בשר מתחת ל-55°C מעבר ל-4 שעות (כולל זמן עלייה לחום) — מתחת לסף זה פתוגנים עלולים להתרבות מהר מדי."),
 ("בטיחות","טפילים בדג","Anisakis","דג בטמפ׳ סו-ויד נמוכה (50–52°C) אינו בטוח מטפילים ללא הקפאה מוקדמת (-20°C ל-7 ימים) או שימוש בדג סושי-גרייד שהוקפא."),
 ("בטיחות","פעילות מים","Water Activity (Aw)","מדד המים הזמינים לחיידקים. נקניק מיובש בטוח כשה-Aw יורד ל-~0.85 (יחד עם pH נמוך) — מה שמושג בירידת משקל של 30–40%."),
 ("בטיחות","התקשות קליפה","Case Hardening","כשפני הנקניק מתייבשים מהר מדי ו'אוטמים' לחות בפנים (מרכז רטוב, קליפה קשה). נמנע ע״י לחות 70–80% ומאוורר במחזוריות."),
 ("בטיחות","pH בהתססה","Fermentation pH","ירידת ה-pH בהתססה (ל-≤5.3 לדרי, 4.6–5.2 לחצי-דרי) היא מחסום הבטיחות הראשון בנקניקים מיובשים, לצד הניטריט והייבוש."),
 # ── sausage-making & from-scratch technique ──
 ("נקניקים","בנייה מאפס","From Scratch","תהליך ייצור מלא של מוצר בשר טחון: טחינה → תיבול → לישה/קישור → מילוי → בישול. באפליקציה מנוהל כ'פרויקט מאפס' עם מעקב שלבים במזווה."),
 ("נקניקים","פוץ' (חליטה עדינה)","Poach","בישול עדין במים ~75-80°C (בועות קטנות, לא רתיחה) עד טמפ' פנים ~71-72°. השיטה המקצועית לנקניקיות עבות — מבשל אחיד בלי לפצח את הקרום, ואז צריבה קצרה לצבע."),
 ("נקניקים","קישור ראשוני (מיוזין)","Primary Bind","לישת בשר טחון מלוח עד עיסה דביקה — המלח מחלץ חלבון מיוזין שמלכד את התערובת. זה מה שמחזיק נקניקייה על השיפוד ונותן 'נשיכה' פריכה. בלעדיו הנקניק מתפורר."),
 ("נקניקים","אמולסיה","Emulsion","טחינה דקה מאוד של בשר, שומן, קרח ומלח לעיסה חלקה ואחידה — הבסיס לנקניקים 'עדינים' (פרנקפורטר, וייסוורסט, מורטדלה, בולוניה). דורשת שמירה על קור (מתחת 12°) שלא ל'שבור' את האמולסיה."),
 ("נקניקים","שרוול / קרביים","Casing","העטיפה שהמילוי נדחס לתוכה — טבעי (כבש 20-22 מ״מ לנקניקיות דקות, חזיר 32-36 מ״מ, בקר לסלמי) או קולגני. משרים ושוטפים לפני מילוי; דוקרים בועות אוויר."),
 ("נקניקים","מנוחת עיסה","Meat Rest","קירור העיסה לפני עיצוב/מילוי — מהדק שומן, מייצב מרקם. בקבב רומני (מיצ׳י) עם סודה לשתייה נדרשות 24-48 שעות במקרר כדי שהסודה תרכך ותקשר."),
 ("נקניקים","סודה לשתייה (ריכוך)","Baking Soda","מוסיפה מרקם קפיצי-רך וקישור לקבב/קופתה טחונים. מעלה pH מקומית ומשפרת אחיזת-מים; דורשת מנוחת-לילה לפני צלייה כדי לפעול."),
 ("נקניקים","ייצוב לפני צלייה","Set / Stabilize","קירור קצר (30-60 דק') של נקניקייה ממולאת לפני בישול — מהדק את השומן, שומר צורה, מונע 'התזת שומן' והתפרקות בגריל."),
 # ── projects & pantry (app model) ──
 ("פרויקטים","פרויקט מאפס","Scratch Project","מלאכה טרייה (נקניקייה, קבב, שווארמה) שמנוהלת כפרויקט: עוקבים אחרי שלבי הבנייה, מאחסנים במזווה, ומסיימים בהמשך. שונה מפרויקט ייבוש/כבישה שנמדד במשקל/ימים."),
 ("פרויקטים","מזווה כמחסן רכיבים","Pantry Store","המזווה מגשר בין ייצור להגשה: מייצרים מאפס או קונים מוכן → מאחסנים → מוסיפים שלב סיום אם צריך (עישון לגבינה) → מגשרים לאירוע. פריט נכנס לתוכנית כ'רק סיום' או 'מוכן להגשה'."),
 ("פרויקטים","שלב הכנה מול הגשה","Prep vs Finish","מלאכות רבות מתחלקות לשני מועדים: 'הכנה מראש' (טחינה→מילוי→יישון/פוץ') ו'סיום' (צלייה/צריבה ביום ההגשה). האפליקציה מפצלת אוטומטית בגבול היישון/מנוחה."),]

# ---------------------------------------------------------------------------
# BUILDS: deep "make-it-from-scratch" recipes for complex / processed items.
# Keyed by "cut-N" or "spec-N". Uses Unicode gershayim ״ / geresh ׳ to avoid escaping.
# phase tuple: (title, detail, seconds) ; seconds=0 -> no timer
# ---------------------------------------------------------------------------
BUILDS = {}

# ===== FLAGSHIP: SAUSAGES (cut #16) — German cheese sausage as worked example =====
BUILDS["cut-16"] = dict(
 intro="מדריך מלא לייצור נקניקיות מאפס. הדוגמה המובילה היא קֵזֶה-קְרַיינֶר (Käsekrainer) — נקניקיית חזיר גרמנית/אוסטרית עם קוביות גבינה שנמסה בצלייה. כל שלב מפורט; בהמשך גם משפחת ווריאנטים (בראטוורסט, מרגז, פרנקפורטר, איטלקי ועוד).",
 materials=[
  "מטחנת בשר עם פלטות 8 מ״מ (גס) ו-4.5 מ״מ (דק)",
  "מכשיר מילוי (sausage stuffer) — אופקי/אנכי, עדיף על מטחנה",
  "שרוולי חזיר טבעיים 32–34 מ״מ (או קולגן 32 מ״מ אכיל)",
  "חוט קצבים לקשירה + מחט/דוקרן לבועות אוויר",
  "מדחום פנימי (MEATER/Inkbird)",
  "מלח ים 18 ג׳/ק״ג · Cure #1 (ורוד) 2.5 ג׳/ק״ג · קרח כתוש 10–15%",
  "לקזה-קריינר: חזיר רזה 75% + שומן גב 25% + אמנטל/גאודה בקוביות 5 מ״מ (15–20%)",
 ],
 variants=[
  ("קֵזֶה-קריינר (גבינה) — הדוגמה","חזיר 75% + שומן גב 25%, טחינה 8 מ״מ. תיבול: מלח, פלפל לבן, שום, כמון, פפריקה מתוקה. מערבבים 15–20% קוביות אמנטל לתערובת בסוף. שרוול חזיר 32–34 מ״מ. עישון חם קל ואז צלייה — הגבינה נמסה ומתפרצת."),
  ("בראטוורסט","חזיר + 10–20% עגל, טחינה דקה 4.5 מ״מ למרקם עדין. תיבול קלאסי: אגוז מוסקט, ג׳ינג׳ר יבש, פלפל לבן, גרידת לימון. שרוול חזיר 32 מ״מ. טרי (ללא Cure), בישול/צלייה."),
  ("מרגז","טלה (או טלה+בקר) עם 20% שומן, טחינה 6 מ״מ. הריסה, כמון, כוסברה טחונה, שום, פפריקה חריפה. שרוול כבש דק 22–24 מ״מ. טרי, צלייה חזקה ומהירה."),
  ("פרנקפורטר / וינר","אמולסיה דקה: חזיר+בקר עם קרח, טוחנים פעמיים ומקציפים. פפריקה, שום, חרדל, אגוז מוסקט. Cure #1. שרוול כבש 24 מ״מ. עישון קל ובישול ל-72°C."),
  ("נקניק איטלקי (מתוק/חריף)","חזיר 80/20, טחינה 8 מ״מ. זרעי שומר (fennel), פלפל גס, שום, יין אדום (+פתיתי צ׳ילי לחריף). שרוול חזיר 32 מ״מ. טרי."),
  ("טולוז","חזיר גס בטחינה 10 מ״מ למרקם נתחי. מלח, פלפל, שום, יין לבן, אגוז מוסקט. שרוול חזיר 32–36 מ״מ. טרי — מצוין לקסולה/קונפי."),
  ("צ׳וריסו טרי","חזיר 80/20, פפריקה מעושנת (pimentón), שום, אורגנו, מעט חומץ. שרוול חזיר 32 מ״מ. טרי, לצלייה."),
 ],
 phases=[
  ("1 · בחירת בשר ושומן","יחס שומן 20–30% הוא הסוד למרקם עסיסי. לקזה-קריינר: כתף חזיר רזה 75% + שומן גב קשה 25%. שומן גב (לא שומן רך מהבטן) שומר על הגדרה ולא נמרח. גזור גידים קשים.",0),
  ("2 · צינון עמוק","הקפא חלקית את הבשר והשומן (~45–60 דק׳ במקפיא) עד שהם נוקשים אך נחתכים, וצנן את חלקי המטחנה. עבודה ב-0–2°C מונעת 'מריחת שומן' (fat smear) שהורסת מרקם.",2700),
  ("3 · טחינה","העבר דרך פלטה גסה 8 מ״מ (לקזה-קריינר). לבראטוורסט/פרנקפורטר — טחינה שנייה בפלטה 4.5 מ״מ. שמור על הקור; אם נמס — החזר למקפיא 15 דק׳.",0),
  ("4 · ריפוי ותיבול","שקול מדויק: מלח 18 ג׳/ק״ג, ולמוצר מעושן/מבושל גם Cure #1 2.5 ג׳/ק״ג. הוסף תבלינים (לקזה-קריינר: פלפל לבן, שום, כמון, פפריקה). הקוביות גבינה נכנסות בשלב הערבוב, לא בטחינה.",0),
  ("5 · ערבוב וחילוץ חלבון (bind)","לוש את התערובת עם 10–15% קרח/מים קרים כ-2–4 דק׳ עד שהיא נעשית דביקה ונצמדת לכף היד — זהו חילוץ החלבון המיוסין שמלכד את הנקניק. בסוף קפל פנימה את קוביות הגבינה בעדינות כדי לא לרסק.",0),
  ("6 · מבחן טעם","טגן 'מטבע' קטן מהתערובת ובדוק מליחות ותיבול. תקן לפני המילוי — אי אפשר לתקן אחרי.",0),
  ("7 · מילוי בשרוול","השרה שרוולי חזיר 32–34 מ״מ במים פושרים 30 דק׳ ושטוף מבפנים. העבר את התערובת למכשיר המילוי, גרש אוויר, והשחל את השרוול על הזרבובית. מלא בלחץ אחיד וקצב יציב — לא צפוף מדי (יתפוצץ בקשירה) ולא רפוי.",0),
  ("8 · קשירה ולינקים","קמוט וסובב כל ~12–15 ס״מ לסירוגין (כיוון לכל לינק) ליצירת שרשרת, או קשור בחוט קצבים. דקור בועות אוויר בסיכה. ודא שאין כיסי אוויר ליד הגבינה.",0),
  ("9 · ייבוש / Pellicle","תלה את הנקניקיות במקרר פתוח 1–2 שעות (או בחדר קריר 1 שעה) עד שהמעטפת יבשה ומבריקה. משטח יבש סופג עשן טוב יותר ונותן צבע יפה.",5400),
  ("10 · עישון","עשן בחום נמוך-בינוני (~60–75°C) עם צ׳אנקים בכר/תפוח עד טמפ׳ פנימית 68–72°C. לבראטוורסט/איטלקי טרי — דלג על העישון.",0),
  ("11 · בישול עדין (Poach)","חלופה לעישון או אחריו: בשל באמבט מים 72–75°C (לא רותח!) עד 68°C פנימי. הרתחה תפצח את השרוול ותמיס את השומן. הקזה-קריינר מוכן עכשיו ל'סגירה'.",0),
  ("12 · צלייה והגשה","סיים על גריל פחם חם לקרום פריך ול'סנאפ' של השרוול — ובקזה-קריינר, להמסת הגבינה הפנימית. תן מנוחה קצרה והגש (קלאסי: בלחמנייה עם חרדל).",0),
 ],
)

# ===== KEBAB (cut #17) =====
BUILDS["cut-17"] = dict(
 intro="קבב הוא בשר טחון מתובל, מולכד ביד וצלוי על שיפוד שטוח. הסוד הוא בחירת שומן נכון (שומן אליה/זנב כבש) ולישה עד לכידות, כדי שהבשר לא יישמט מהשיפוד.",
 materials=["מטחנה (פלטה 8 מ״מ)","שיפודים שטוחים ורחבים","קערה לישה + מקרר","שומן כבש/אליה ~20–25%","בצל מגורר, פטרוזיליה, תבלינים"],
 variants=[
  ("קבב בקר-טלה קלאסי","בקר 60% + טלה 40% (כולל שומן אליה). תיבול: בצל מגורר וסחוט, פטרוזיליה, פלפל אנגלי, כמון, מלח, פלפל שחור."),
  ("קבב אדנה (טורקי חריף)","טלה עם שומן זנב, טחינה גסה, פלפל אורפה/איזוט מעושן, שום, פפריקה חריפה. ידני — נקצץ בסכין במקום מטחנה."),
  ("קבב עוף","ירך עוף טחון + מעט שומן עור, שום, פפריקה, כמון, כורכום. דורש לישה ארוכה יותר ללכידות."),
  ("קבב כורדי (חצילים/בצל)","בקר-טלה עם פרוסות חציל/בצל בין שכבות על השיפוד; שומני ועסיסי."),
  ("מיצ׳י / מיטיטֵיי (רומני)","בקר+חזיר/טלה **ללא שיפוד וללא שרוול** — גלילים קצרים עם שום, צ׳ימברו וסודה לשתייה לאווריריות. מתכון בנייה מלא ב'בית המלאכה'."),
  ("צ׳בפי (בלקני)","בן-דוד של מיצ׳י — בקר/טלה בלבד, פחות תבלין, מוגש עם בצל, פיתה וקאימאק."),
 ],
 phases=[
  ("1 · בשר ושומן","בחר נתחים עם קולגן וטעם (צוואר/שריר בקר) + שומן אליה כבש 20–25%. שומן אליה נמס יפה ונותן את הטעם והעסיסיות האופייניים.",0),
  ("2 · טחינה גסה","טחן פעם אחת בפלטה 8 מ״מ. אל תטחן עודף — קבב צריך מרקם ולא עיסה. שמור קר.",0),
  ("3 · בצל ותיבול","גרר בצל וסחוט היטב מהנוזלים (נוזל בצל מרכך מדי ומפרק). הוסף פטרוזיליה קצוצה ותבלינים. מלח נכנס בשלב הלישה.",0),
  ("4 · לישה ולכידות","לוש ביד נמרצות 5–8 דק׳ עד שהתערובת דביקה, חלקה ומתלכדת לכדור שלא מתפרק. זהו ה'בּינד' שמחזיק את הקבב על השיפוד.",0),
  ("5 · מנוחה וקירור","כסה וקרר לפחות שעה (עדיף 2–3). הקור והמנוחה מהדקים את התערובת ומקלים על ההצמדה לשיפוד.",3600),
  ("6 · עיצוב על שיפוד","בידיים רטובות, לחץ את הבשר לאורך שיפוד שטוח רחב לצורת נקניק אחיד. הקפד על עובי שווה לצלייה אחידה.",0),
  ("7 · ייצוב","החזר את השיפודים המעוצבים למקרר 20–30 דק׳ להתייצבות לפני האש.",1800),
  ("8 · צלייה / סו-ויד","צלה ישירות מעל פחם חזק תוך סיבוב — קרום מהיר ולב עסיסי (יעד פנימי ~65°C, בטיחות טחון 71°C). חלופה: סו-ויד 60°C ואז צריבה חזקה.",0),
  ("9 · מנוחה והגשה","נוח 5 דק׳, החלק מהשיפוד והגש (בלאפה עם טחינה ובצל, או לצד אורז).",300),
 ],
)

# ===== HAMBURGER (cut #18) =====
BUILDS["cut-18"] = dict(
 intro="המבורגר נהדר מתחיל בבליל (blend) ובטחינה — לא בתיבול. שילוב נתחים נכון נותן עומק טעם, אחוז שומן ~20% נותן עסיסיות, וטחינה טרייה ביתית נותנת מרקם ובטיחות לדרגות עשייה נמוכות.",
 materials=["מטחנה (פלטה 8 מ״מ)","משקל מטבח","טבעת/לחיצה לעיצוב","מחבת ברזל יצוק / פלאנצ׳ה / גריל","מדחום פנימי"],
 variants=[
  ("בליל סטייקהаус","צ׳אק 70% + בריסקט/שפונדרה 20% + אונטרייב 10%. עומק, שומן ולעיסה — קלאסי לפטי עבה."),
  ("קלאסי 80/20","צ׳אק בלבד 80/20. פשוט, מאוזן, עובד תמיד."),
  ("סמאש","צ׳אק 80/20 טחון פעם אחת. כדורים שמועכים דק על משטח חם ללצ׳-אפ קריספי ושוליים תחרתיים."),
  ("בליל יבש-מיושן","הוסף 15% שאריות בשר מיושן (dry-aged trim) לבליל לטעם אגוזי-אומאמי."),
 ],
 phases=[
  ("1 · בחירת נתחים","הרכב בליל לפי ~20% שומן. צ׳אק כבסיס, ועוד נתח טעם (בריסקט/אונטרייב). בקש מהקצב נתחים שלמים לטחינה ביתית טרייה.",0),
  ("2 · הקפאה קלה","קצוץ לקוביות וצנן/הקפא חלקית 30–45 דק׳ עם חלקי המטחנה. בשר קר נטחן נקי ולא נמרח.",2700),
  ("3 · טחינה","טחן פעם אחת בפלטה 8 מ״מ (לסמאש), או פעמיים למרקם צפוף יותר. אל תדחס את הבשר לתוך המטחנה.",0),
  ("4 · עיצוב עדין","עצב פטי ביד קלה — אל תדחס! בשר דחוס = מרקם נקניק. צור גומה קלה במרכז כדי שלא יתנפח. אל תוסיף מלח לבליל (מלח בפנים מחלץ חלבון והופך למרקם גומי).",0),
  ("5 · מלח ברגע האחרון","מלח רק את החוץ של הפטי רגע לפני הצלייה, בנדיבות.",0),
  ("6 · בישול","סמאש: מעיכה על משטח לוהט 60–90 שניות לצד, קרום עמוק. עבה: סו-ויד 55°C ואז צריבה, או עישון קל ואז צריבה (reverse sear). יעד מדיום ~57°C; טחון מסחרי — 71°C לבטיחות.",0),
  ("7 · גבינה ומנוחה","הוסף גבינה ב-30 השניות האחרונות לכיסוי. נוח 2–3 דק׳ והרכב בלחמנייה מאודה.",180),
 ],
)

# ===== PASTRAMI (cut #12) =====
BUILDS["cut-12"] = dict(
 intro="פסטרמה היא בקר כבוש (brine cure), מצופה בכוסברה ופלפל, מעושן ומאודה לרכות. נתח קלאסי: נאבל/בריסקט. דורש סבלנות — הכבישה לבדה 5–7 ימים.",
 materials=["נתח בריסקט/נאבל בקר","מיכל כבישה גדול + מקרר","Cure #1 + מלח + סוכר + תערובת חמוצים (pickling spice)","כוסברה גרוסה + פלפל שחור גס לציפוי","מעשנת + מאדה/סיר ענק"],
 variants=[
  ("ניו-יורק קלאסית","בריסקט (point), ציפוי כוסברה-פלפל כבד, עישון ואז אידוי עד ~96°C פנימי לפריכות שנמסה."),
  ("מונטריאול סמוקד מיט","יותר פלפל ושום, פחות סוכר; כבישה ארוכה יותר, מרקם רך-לח."),
  ("פסטרמה הודו","חזה הודו רזה — כבישה קצרה יותר (2–3 ימים), עישון עד 74°C; קלה ובריאה יותר."),
 ],
 phases=[
  ("1 · תמלחת כבישה","הכן תמלחת: לכל ליטר מים — מלח 50 ג׳, Cure #1 ~12 ג׳ (לפי משקל/נפח), סוכר חום, ותערובת חמוצים (חרדל, כוסברה, ערער, עלי דפנה, שום). הרתח, קרר לחלוטין.",0),
  ("2 · כבישה (5–7 ימים)","טבול את הבריסקט בתמלחת הקרה במקרר, משוקלל מתחת לפני הנוזל. כְּבוש ~24 שעות לכל 1 ס״מ עובי (בד״כ 5–7 ימים). הפוך פעם ביום.",0),
  ("3 · השריה והסרת מלח","שטוף ושרה במים קרים 2–6 שעות (החלף מים) להפחתת מליחות. ייבש היטב.",0),
  ("4 · יצירת Pellicle","הנח גלוי במקרר 8–12 שעות עד משטח דביק-מבריק — בסיס מצוין לציפוי ולספיחת עשן.",0),
  ("5 · ציפוי כוסברה-פלפל","טחן גס כוסברה ופלפל שחור (1:1) וצפה את כל הנתח בשכבה עבה ולחוצה. זהו ה'קרום' (bark) האופייני.",0),
  ("6 · עישון","עשן ב-105–120°C עם אלון/היקורי עד טמפ׳ פנימית ~70–75°C. חלופה מהירה: סו-ויד 65°C/12h ואז עישון קצר רק לקרום.",0),
  ("7 · אידוי לרכות","אדה את הפסטרמה (סיר עם רשת מעל מים רותחים) ~1–2 שעות עד ~95–96°C פנימי — כך הקולגן נמס והנתח נחתך כמו חמאה.",0),
  ("8 · קירור ופריסה","קרר, ואז חמם מחדש בקיטור לפני ההגשה. פרוס דק נגד הסיבים (קלאסי: בכריך שיפודרינו עם חרדל).",0),
 ],
)

# ===== SHAWARMA (cut #3) =====
BUILDS["cut-3"] = dict(
 intro="שווארמה היא שיפוד אנכי בנוי משכבות בשר דקות ומתובלות, עם שכבות שומן ביניהן ו'כובע' שומן בראש. המבנה הוא הסוד: עליו תלויים העסיסיות והשוליים הפריכים שמגלחים.",
 materials=["שיפוד שווארמה אנכי/אופקי או גריל מסתובב","פרוסות בשר דקות","שומן כבש/אליה לשכבות","תערובת שווארמה (בהרט) + שמן + בצל + לימון"],
 variants=[
  ("שווארמה הודו","פרגיות/שוקי הודו פרוסות + שומן כבש בין השכבות. תיבול בהרט, כורכום, הל, שמן. עסיסית וכלכלית."),
  ("שווארמה טלה/בקר","אנטריקוט/שפונדרה דק + שומן אליה. עשירה ובשרית; קלאסיקה ערבית."),
  ("שווארמה עוף","חזה+ירך עוף במרינדת יוגורט, שום, לימון, פפריקה — מרככת ומשחימה יפה."),
 ],
 phases=[
  ("1 · פריסה דקה","פרוס את הבשר לפרוסות דקות ואחידות (~3–5 מ״מ). אחידות = גילוח אחיד וצלייה שווה.",0),
  ("2 · מרינדה","ערבב תערובת שווארמה (בהרט/בהרת), שמן זית, בצל מרוסק ולימון. לעוף — הוסף יוגורט. מרינדה במקרר לילה.",0),
  ("3 · בניית השיפוד","השחל לסירוגין שכבת בשר רזה ושכבת שומן, תוך הידוק, לבניית גליל צפוף. הנח 'כובע' שומן/בשר שמן בראש — הוא נוטף ומשקה את כל הגליל.",0),
  ("4 · בישול עדין (אופציונלי)","אפשר לעטוף את כל הגליל ולבשל בסו-ויד 74°C/12h לעסיסיות מקסימלית, ואז להעביר לאש לקרום.",0),
  ("5 · צלייה וסיבוב","צלה ליד אש בינונית תוך סיבוב איטי. השכבה החיצונית מזהיבה ומתקרמת.",0),
  ("6 · גילוח מתגלגל","גלח את השכבה החיצונית הפריכה ברגע שהיא מוכנה, חשוף את השכבה הבאה והמשך. עוף/הודו — ודא 74°C פנימי. הגש מיד בלאפה/פיתה.",0),
 ],
)

# ---------- helper builders for SPECIALS ----------
def sausage_smoked(meat, cure, casing, smoke, target, note, variants):
    return dict(
      intro=note,
      calc=dict(salt=18, cure='1', cureRate=2.5, sugar=0, water=12, brine=False, saltL=0, cureL=0, sugarL=0),
      materials=["מטחנה + מכשיר מילוי", casing, "מלח 18 ג׳/ק״ג + "+cure, "מדחום פנימי", "צ׳אנקים לעישון"],
      variants=variants,
      phases=[
        ("1 · בשר, שומן וצינון","בליל "+meat+", עם 20–30% שומן. הקפא חלקית את הבשר, השומן וחלקי המטחנה לעבודה ב-0–2°C.",2700),
        ("2 · טחינה","טחן בפלטה המתאימה (גס 8 מ״מ לכפרי, דק 4.5 מ״מ לחלק). שמור קר לאורך כל הדרך.",0),
        ("3 · ריפוי ותיבול","שקול מלח 18 ג׳/ק״ג ו-"+cure+". הוסף את התבלינים האופייניים והערבב היטב.",0),
        ("4 · ערבוב (bind)","לוש עם 10–15% קרח עד דביקות וחילוץ חלבון; התערובת צריכה להיצמד לכף.",0),
        ("5 · מילוי וקשירה","מלא ל"+casing+" בלחץ אחיד, צור לינקים/קשור, ודקור בועות אוויר.",0),
        ("6 · Pellicle","תלה במקרר 1–2 שעות עד מעטפת יבשה לקליטת עשן.",5400),
        ("7 · עישון מדורג","עשן לפי "+smoke+" עד טמפ׳ פנימית "+target+". התחל נמוך ועלה בהדרגה למניעת קמטים.",0),
        ("8 · קירור והבשלה","קרר במקלחת קרה/אמבט קרח לעצירת בישול, ואז מנוחה במקרר לפני ההגשה.",0),
      ],
    )

def sausage_dry(meat, cure, casing, ferment, dry, note, variants):
    return dict(
      intro=note+" ⚠ מוצר מיובש לא מבושל — בקרת טמפ׳, לחות ו-pH קריטית לבטיחות. עבוד נקי ובמדויק.",
      calc=dict(salt=28, cure='2', cureRate=2.5, sugar=3, water=0, brine=False, saltL=0, cureL=0, sugarL=0),
      materials=["מטחנה + מכשיר מילוי", casing, "מלח 28–30 ג׳/ק״ג + "+cure, "תרבית התססה (Bactoferm) לפי יצרן", "מד pH + מד לחות (hygrometer) + מאזניים", "תא הבשלה: התססה ~24°C/85%; ייבוש 12–15°C/70–80%"],
      variants=variants,
      phases=[
        ("1 · בשר ושומן נקיים","בליל "+meat+" עם ~25–30% שומן גב קשה. היגיינה מוחלטת; הקפא חלקית לטחינה נקייה.",0),
        ("2 · טחינה","טחן בפלטה 4–6 מ״מ. שמור הכל מתחת ל-2°C כדי לשמר הגדרת שומן.",0),
        ("3 · ריפוי + תרבית","מלח 28–30 ג׳/ק״ג, "+cure+" (Cure #2 לשחרור חנקה איטי), דקסטרוז ~3 ג׳/ק״ג (מזון לתרבית), ותרבית התססה מומסת במים לא-מוכלרים. ערבב עד דביקות.",0),
        ("4 · מילוי ושקילת יעד","מלא ל"+casing+" בצפיפות מלאה וללא אוויר. קשור. **שקול כל נקניק ורשום משקל יעד = משקל התחלתי × 0.62–0.65** (ירידה 35–40%) — זהו מדד המוכנוּת האמיתי, לא הזמן.",0),
        ("5 · התססה (עד pH)","החזק "+ferment+" ב-~24°C ולחות 80–90% עד **ירידת pH ל-≤5.3** (דרי) / 4.6–5.2 (חצי-דרי). זהו מחסום הבטיחות הראשון.",0),
        ("6 · עישון קר (אופציונלי)","אם רוצים טעם מעושן — עשן קר ≤25°C בכמה מחזורים קצרים. לא חובה.",0),
        ("7 · הבשלה וייבוש","ייבש ב-**12–15°C ולחות 70–80%** עם **מאוורר במחזוריות (5 דק׳ פעיל / 25 כבוי)** למניעת 'התקשות קליפה' (case hardening). המשך "+dry+" עד שמשקל היעד מושג ו-Aw ≈ 0.85.",0),
        ("8 · בדיקה ופריסה","מוכן כשמוצק ואחיד לאורך החתך (עובש לבן רצוי; ירוק/שחור — להסיר/לפסול). פרוס דק והגש.",0),
      ],
    )

def bacon(meat, target, smoke, note):
    return dict(
      intro=note,
      materials=["נתח שלם ("+meat+")", "מלח ~20 ג׳/ק״ג + Cure #1 ~2.0 ג׳/ק״ג (120ppm — הסטנדרט לבייקון) + סוכר חום", "שקית ואקום/מיכל לכבישה", "מעשנת + צ׳אנקים", "מדחום + מקרר"],
      variants=[],
      phases=[
        ("1 · כבישה יבשה (equilibrium)","שקול את הנתח. ערבב מלח (~20 ג׳/ק״ג), **Cure #1 ~2.0 ג׳/ק״ג (≈120ppm ניטריט — תקן USDA לבייקון, נמוך מ-156)** וסוכר חום. שפשף על כל השטח, סגור בוואקום.",0),
        ("2 · המתנה (~7 ימים)","הנח במקרר ~7 ימים (יום לכל ~0.5 ס״מ עובי), הפוך כל יום. הכבישה האחידה מבטיחה ריפוי בטוח לכל העובי.",0),
        ("3 · שטיפה וייבוש","שטוף את עודפי המלח, ייבש, והנח גלוי במקרר 12–24 שעות ל-Pellicle.",0),
        ("4 · עישון","עשן ב-"+smoke+" עד טמפ׳ פנימית "+target+". עשן עדין (תפוח/היקורי) מוסיף את האופי הקלאסי.",0),
        ("5 · קירור ופריסה","קרר היטב במקרר (קל יותר לפרוס קר). פרוס דק.",0),
        ("6 · טיגון לפני אכילה","הבייקון מעושן אך לא מבושל במלואו — טגן/אפה עד פריך לפני האכילה.",0),
      ],
    )

def cheese_cold(temp, smoke_h, wood, rest, note):
    return dict(
      intro=note+" עישון קר בלבד — חום ימיס את הגבינה. שאף ל-≤25°C (אידיאלי 'שלגי', אפילו קרוב ל-0°C); מעל 30°C הגבינה מתחילה להזיע ולהימס.",
      materials=["גבינה קשה/חצי-קשה בבלוקים", "מחולל עשן (tube/maze) + "+wood, "מעשנת/ארגז ללא חום ישיר", "מגש קרח (לימים חמים)", "ואקום/ניילון נצמד לאיטום", "מקרר להבשלה"],
      variants=[],
      phases=[
        ("1 · טמפור וייבוש","הוצא את הגבינה מהמקרר ~1 שעה שתתייצב, ויבש את פניה (לחות מפריעה לספיחת עשן). חתוך לבלוקים — יותר שטח פנים = יותר עשן.",3600),
        ("2 · בקרת חום","שאף לטמפ׳ תא **≤25°C** (לא יותר מ-30°C בשום מקרה). בימים חמים — עשן בלילה והנח **מגש קרח** מתחת לגבינה. מחולל עשן נותן עשן כמעט ללא חום (גם המאוורר לא צריך לעבוד).",0),
        ("3 · עישון קר","עשן "+smoke_h+" עם "+wood+", **והפוך את הבלוקים כל ~20–30 דק׳** לעישון אחיד מכל הצדדים. הגבינה לא אמורה להשחים — חום-יתר נותן 'קרום יבש' ולא 'rind'.",0),
        ("4 · איטום","נגב לחות, ואז עטוף/ואקום אחרי שהגבינה התקררה במקרר — מונע ייבוש ומאפשר לטעם להתפזר אחיד.",0),
        ("5 · הבשלה","הנח במקרר "+rest+". זהו השלב הקריטי: הטעם החריף-עשני מתמתן והופך מעוגל ונעים — אל תאכל מיד.",0),
      ],
    )

# ----- specials builds -----
BUILDS["spec-1"] = dict(  # Beef Jerky
 intro="ג׳רקי בקר — רצועות בשר רזה, מתובלות, מיובשות בעישון נמוך עד מרקם כמו-עור גמיש.",
 materials=["נתח רזה (שייטל/פלאנק/ראונד)","מרינדת סויה/ווסטרשייר + תבלינים (+ Cure #1 לאחסון ארוך)","מעשנת בטמפ׳ נמוכה / מייבש","סכין חדה / פורסת"],
 variants=[("טריאקי","סויה+דבש+ג׳ינג׳ר+שום."),("מעושן-חריף","פפריקה מעושנת+קיין+שום+פלפל שחור."),("בלאק-פפר קלאסי","ווסטרשייר+המון פלפל גס+מלח שום.")],
 phases=[
  ("1 · קירור ופריסה","הקפא חלקית את הנתח ופרוס רצועות 5 מ״מ. נגד הסיבים = רך וקל ללעיסה; עם הסיבים = לעיס וקשוח יותר.",1800),
  ("2 · מרינדה","השרה במרינדה 6–24 שעות במקרר. ל אחסון ארוך וברירת מחדל בטוחה הוסף Cure #1 לפי משקל.",0),
  ("3 · ניגוב","נגב את הרצועות מהמרינדה ויבש; משטח לח לא נספג היטב.",0),
  ("4 · עישון/ייבוש","עשן ב-70°C 4–6 שעות עם היקורי/מזקיט. שמור על זרימת אוויר.",0),
  ("5 · מבחן מוכנות","מוכן כשמתכופף ונסדק אך לא נשבר. קרר ואחסן באטום.",0),
 ],
)
BUILDS["spec-2"] = dict(  # Turkey Jerky
 intro="ג׳רקי הודו — גרסה רזה ודלת שומן; חובה להגיע ל-74°C לבטיחות עוף לפני/תוך הייבוש.",
 materials=["חזה הודו","מרינדה דלת שומן","מעשנת נמוכה","מדחום"],
 variants=[("מתוק-מעושן","מייפל+סויה+פפריקה מעושנת."),("חריף","סרירצ׳ה+שום+ליים.")],
 phases=[
  ("1 · פריסה","הקפא חלקית ופרוס 5 מ״מ נגד הסיבים.",1800),
  ("2 · מרינדה","6–12 שעות במקרר.",0),
  ("3 · ייבוש בטוח","עשן ב-70°C עד 74°C פנימי ואז המשך לייבוש 4–5 שעות.",0),
  ("4 · מוכנות","יבש-גמיש; קרר ואחסן.",0),
 ],
)
BUILDS["spec-3"] = dict(  # Biltong
 intro="בילטונג — ייבוש אוויר דרום-אפריקאי בכבישת חומץ ותבלינים, ללא עישון. מיובש בטמפ׳ חדר נעימה (~21–27°C) ולחות 50–60% — זרימת אוויר היא הכל; החומץ והמלח מספקים את הבטיחות.",
 materials=["נתח בקר רזה (סילברסייד)","חומץ תפוחים/יין","מלח גס + כוסברה קלויה + פלפל שחור","ארון ייבוש עם מאוורר ותאורה עדינה"],
 variants=[("קלאסי","כוסברה+פלפל+מלח, חומץ תפוחים."),("חריף","תוספת פפריקה חריפה ופלפלי צ׳ילי.")],
 phases=[
  ("1 · חיתוך","חתוך רצועות עבות (~2–3 ס״מ) עם כיוון הסיבים.",0),
  ("2 · כבישת חומץ","הברש בחומץ והשרה קצרות; החומץ מחטא ומטעים.",0),
  ("3 · תיבול","גלגל במלח גס, כוסברה קלויה גרוסה ופלפל. הנח 1–2 שעות שהמלח יחדור.",3600),
  ("4 · תלייה","תלה בארון מאוורר בטמפ׳ חדר נעימה (~21–27°C) ולחות ~50–60%, ללא מגע בין הרצועות. שלא יהיה קר מדי (יאט) או חם מדי (יקלקל).",0),
  ("5 · ייבוש (4–7 ימים)","ייבש 4–7 ימים בזרימת אוויר עדינה. רך יותר = פחות זמן; קשה ויבש = יותר. החומץ והמלח הם המגן (לא חום). פרוס דק להגשה.",0),
 ],
)
BUILDS["spec-4"] = bacon("בטן חזיר","65°C","90°C 3–4 שעות (תפוח/היקורי)","בייקון חזיר קלאסי — כבישה יבשה, ייבוש, עישון. הבסיס לכל מנת בוקר.")
BUILDS["spec-5"] = bacon("נאבל/בטן בקר","65°C","90°C ~3 שעות (היקורי/אלון)","בייקון בקר — עשיר ובשרי יותר מחזיר, מצוין לכריכים ולעטיפות.")
BUILDS["spec-6"] = sausage_smoked("חזיר (כתף) + מעט בקר","Cure #1 2.5 ג׳/ק״ג","שרוול חזיר 32–36 מ״מ","עישון מדורג 60°C→75°C עם אלון/בכר/תפוח","68°C","קילבסה — נקניק פולני מבושל-מעושן. אפשר להגיש מיד או לצרוב.",
  [("קילבסה מסורתית","חזיר גס, שום בולט, פלפל אנגלי ומיורן."),("חריפה","תוספת פפריקה חריפה ושום קלוי.")])
BUILDS["spec-7"] = sausage_smoked("חזיר","Cure #1 2.5 ג׳/ק״ג","שרוול חזיר 35 מ״מ","עישון כבד 70°C עם פקאן/היקורי","68°C","אנדוי — נקניק קייג׳ן חריף ומעושן בכבדות, קלאסי לגמבו וג׳מבלאיה.",
  [("קייג׳ן קלאסי","קיין, פפריקה, שום, טימין, פלפל שחור — חריף ומעושן.")])
BUILDS["spec-8"] = sausage_smoked("בקר + חזיר","Cure #1 2.5 ג׳/ק״ג","שרוול חזיר 40 מ״מ","עישון 50°C→60°C עם בכר/אלון","68°C","סרוולט — נקניק חצי-יבש שוויצרי/גרמני; עישון מתון וטעם עדין.",
  [("סרוולט שוויצרי","פלפל לבן, אגוז מוסקט, כוסברה; מרקם חלק.")])
BUILDS["spec-9"] = sausage_smoked("בקר + חזיר עם תרבית","Cure #1 2.5 ג׳/ק״ג + תרבית התססה","שרוול פיברי 55–60 מ״מ","עישון מדורג 50°C→75°C","68°C","סאמר סוסג׳ — נקניק חצי-יבש מותסס עם טעם חמצמץ (טאנג) אופייני.",
  [("קלאסי","זרעי חרדל שלמים + שום + פלפל; טאנג מההתססה."),("חריף","תוספת ג׳לפיניו וגבינה.")])
BUILDS["spec-10"] = sausage_dry("חזיר רזה + שומן גב","Cure #2","שרוול כבש דק 24 מ״מ","חם ולח 24–48 שעות (ירידת pH)","5–10 ימים (ירידה 30–35%)","קבנוס — מקלוני חזיר דקים ויבשים לנשנוש; פצפוץ אופייני.",
  [("קלאסי פולני","פלפל, כמון, שום; דק וארוך."),("מעושן","עישון קר עדין לפני הייבוש.")])
BUILDS["spec-11"] = sausage_dry("חזיר (או חזיר+בקר)","Cure #2","שרוול בקר 55–60 מ״מ","חם ולח 24–72 שעות","3–6 שבועות (ירידה 30–40%)","סלמי — נקניק מותסס ומיובש קלאסי; דורש בקרת תנאים וניסיון.",
  [("איטלקי (ג׳נואה)","יין אדום, פלפל גס, שום — מאוזן וקלאסי."),("פלפל (Spianata)","פפריקה חריפה לאורך כל הבלוק.")])
BUILDS["spec-12"] = sausage_dry("חזיר","Cure #2","שרוול חזיר 32–40 מ״מ","חם ולח 24–48 שעות","3–5 שבועות","צ׳וריסו מיובש — ספרדי; הפפריקה המעושנת (pimentón) נותנת צבע וטעם אופייניים.",
  [("דולסה (מתוק)","פימנטון מתוק, שום, אורגנו."),("פיקנטה (חריף)","פימנטון חריף בולט.")])
BUILDS["spec-13"] = sausage_dry("בקר + חזיר","Cure #2","שרוול חזיר 32 מ״מ","חם ולח 24–48 שעות","1–2 שבועות (בלחיצה, שטוח)","לנדיגר — נקניק חצי-יבש דרום-גרמני; מיובש בלחיצה לצורה שטוחה אופיינית.",
  [("קלאסי","שום, כמון, פלפל; עישון קר עדין ואז ייבוש בלחיצה.")])
BUILDS["spec-14"] = sausage_dry("בקר + חזיר","Cure #2","שרוול קולגן 40–55 מ״מ","חם ולח 24–48 שעות","3–4 שבועות","פפרוני — נקניק מותסס-מיובש; קלאסי לפיצה, חריף ופפריקתי.",
  [("אמריקאי","פפריקה+קיין+אניס+שום; דק ואדמדם.")])
BUILDS["spec-15"] = cheese_cold(30,"2–4 שעות","תפוח/אלון/דובדבן","1–2 שבועות","גאודה מעושנת — סופגת עשן יפה ומקבלת קליפה זהובה.")
BUILDS["spec-16"] = cheese_cold(30,"2–4 שעות","היקורי/תפוח","1–2 שבועות","צ׳דר מעושן — אל תאכל מיד; ההמתנה ממתנת את החריפות.")
BUILDS["spec-17"] = cheese_cold(28,"1–2 שעות","אלון/תפוח","מיידי–קצר","סקמורצה/מוצרלה מעושנת — רכה; עישון קצר וקר מאוד (≤28°C).")
BUILDS["spec-18"] = cheese_cold(30,"2–3 שעות","אלון/דובדבן","~שבוע","פרובולון מעושן — קשה-בינונית, סופגת עשן נהדר.")
BUILDS["spec-19"] = dict(  # Smoked cream cheese (hot)
 intro="גבינת שמנת מעושנת — טרנד BBQ: מעשנים חם עם ציפוי ראב, ומגישים כמטבל. היחיד בקבוצה שמעושן חם.",
 materials=["בלוק גבינת שמנת","ראב מתוק/חריף לציפוי","מעשנת ~110°C","צ׳אנקים תפוח/דובדבן"],
 variants=[("מתוק","ראב חום + סילאן/דבש מעל."),("חריף-מעושן","ראב קייג׳ן + מעט סירופ מייפל.")],
 phases=[
  ("1 · חריטה וציפוי","חרוט את פני הבלוק בתבנית מעוינים וצפה בשכבת ראב נדיבה — יותר שטח פנים לעשן ולקרום.",0),
  ("2 · עישון חם","עשן ב-110°C 1.5–2 שעות עד שהפנים רך והחוץ זהוב-מקורם.",0),
  ("3 · הגשה","הגש חם כמטבל עם קרקרים/לחם קלוי.",0),
 ],
)

# ===========================================================================
# Salt/cure calculator metadata on existing builds (g per kg meat) + brine
# ===========================================================================
def setcalc(key, salt=0, cure=None, sugar=0, water=0, brine=False, saltL=0, cureL=0, sugarL=0, cureRate=2.5):
    if key in BUILDS:
        BUILDS[key]['calc']=dict(salt=salt,cure=cure,sugar=sugar,water=water,
                                 brine=brine,saltL=saltL,cureL=cureL,sugarL=sugarL,cureRate=cureRate)
setcalc("cut-16", salt=18, cure="1", sugar=2, water=12)         # sausages (mixed fresh/smoked)
for k in ["spec-6","spec-7","spec-8","spec-9"]: setcalc(k, salt=18, cure="1", sugar=1, water=10)  # smoked-cooked
for k in ["spec-10","spec-11","spec-12","spec-13","spec-14"]: setcalc(k, salt=29, cure="2", sugar=3)  # dry
for k in ["spec-4","spec-5"]: setcalc(k, salt=20, cure="1", sugar=10, cureRate=2.0)  # bacon (120ppm)
for k in ["spec-1","spec-2"]: setcalc(k, salt=15, cure="1", sugar=5)   # jerky
setcalc("spec-3", salt=30, cure=None, sugar=0)                          # biltong
setcalc("cut-12", brine=True, saltL=50, cureL=12, sugarL=20)           # pastrami (brine per liter)

# ===========================================================================
# MAKES — "בית המלאכה": wide catalog of from-scratch builds
# value: dict(heb,eng,cat,diff, build=dict(...))  ; build has same shape + calc
# ===========================================================================
MAKES = {}
def make(mid, heb, eng, cat, diff, build):
    MAKES[mid]=dict(heb=heb,eng=eng,cat=cat,diff=diff,build=build)

def b_fresh(meat, casing, season, cook, note, variants, salt=18, cure=None, sugar=0):
    return dict(intro=note,
      calc=dict(salt=salt,cure=cure,cureRate=2.5,sugar=sugar,water=10,brine=False,saltL=0,cureL=0,sugarL=0),
      materials=["מטחנה + מכשיר מילוי", casing, "מלח "+str(salt)+" ג׳/ק״ג"+(" + Cure #1 2.5 ג׳/ק״ג" if cure=="1" else ""), "קרח כתוש 10%", "מדחום פנימי"],
      variants=variants,
      phases=[
        ("1 · בשר ושומן","בליל "+meat+", יחס שומן ~20–25%. הקפא חלקית את הבשר, השומן וחלקי המטחנה ל-0–2°C למניעת מריחת שומן.",2700),
        ("2 · טחינה","טחן בפלטה המתאימה (גס 8 מ״מ לכפרי, דק 4.5 מ״מ לעדין). שמור קר.",0),
        ("3 · תיבול","שקול מלח "+str(salt)+" ג׳/ק״ג"+(" ו-Cure #1 2.5 ג׳/ק״ג" if cure=="1" else "")+". הוסף: "+season+".",0),
        ("4 · ערבוב (bind)","לוש עם ~10% קרח עד שהתערובת דביקה ונצמדת לכף — חילוץ חלבון מלכד.",0),
        ("5 · מבחן טעם","טגן מטבע קטן, תקן תיבול לפני המילוי.",0),
        ("6 · מילוי וקשירה","מלא ל"+casing+" בלחץ אחיד, צור לינקים/קשור, דקור בועות אוויר.",0),
        ("7 · ייצוב","קרר במקרר 30–60 דק׳ להתייצבות לפני הבישול.",1800),
        ("8 · "+cook[0],cook[1],0),
      ])

def b_emul(meat, casing, season, target, note, variants):
    return dict(intro=note+" נקניק אמולסיה: טחינה כפולה עם קרח והקצפה למרקם חלק ואחיד.",
      calc=dict(salt=18,cure="1",cureRate=2.5,sugar=2,water=20,brine=False,saltL=0,cureL=0,sugarL=0),
      materials=["מטחנה + מעבד מזון/קאטר", casing, "מלח 18 ג׳/ק״ג + Cure #1 2.5 ג׳/ק״ג", "קרח כתוש 15–20%", "מדחום"],
      variants=variants,
      phases=[
        ("1 · בשר קר מאוד","בליל "+meat+". הכל חייב להישאר מתחת ל-4°C לאורך כל הדרך — אמולסיה נשברת בחום.",0),
        ("2 · טחינה ראשונה","טחן בפלטה 4.5 מ״מ.",0),
        ("3 · ריפוי + הקצפה","הוסף מלח, Cure #1 ותבלינים ("+season+"). עבד במעבד עם קרח עד משחה חלקה ומבריקה (אמולסיה).",0),
        ("4 · בקרת טמפ׳","ודא שהמשחה לא עברה ~12°C; אם כן — הקפא קצרות והמשך.",0),
        ("5 · מילוי","מלא ל"+casing+" ללא בועות אוויר. קשור.",0),
        ("6 · Pellicle","תלה במקרר 1–2 שעות לייבוש מעטפת.",5400),
        ("7 · עישון/בישול","עשן קל ובשל באמבט 75°C עד "+target+" פנימי (לא להרתיח — האמולסיה תישבר).",0),
        ("8 · מקלחת קרה","הכנס לאמבט קרח מיד לעצירת בישול ולמרקם 'סנאפ'.",0),
      ])

def b_pastrami(meat, days, smoke, finish, note, variants):
    return dict(intro=note,
      calc=dict(salt=0,cure=None,sugar=0,water=0,brine=True,saltL=50,cureL=12,sugarL=20),
      materials=["נתח "+meat, "מיכל כבישה + מקרר", "מלח + Cure #1 + סוכר + תערובת חמוצים", "כוסברה + פלפל שחור גס לציפוי", "מעשנת + מאדה"],
      variants=variants,
      phases=[
        ("1 · תמלחת","לכל ליטר מים: מלח 50 ג׳, Cure #1 ~12 ג׳, סוכר 20 ג׳, תערובת חמוצים. הרתח וקרר לחלוטין.",0),
        ("2 · כבישה ("+days+")","טבול את הנתח משוקלל מתחת לנוזל, "+days+" במקרר, הפוך יומית.",0),
        ("3 · השריה","שטוף ושרה 2–6 שעות (החלף מים) להפחתת מלח, ייבש.",0),
        ("4 · Pellicle","במקרר גלוי 8–12 שעות עד משטח דביק-מבריק.",0),
        ("5 · ציפוי","כוסברה + פלפל גס (1:1) בשכבה עבה ולחוצה — הקרום האופייני.",0),
        ("6 · עישון",smoke,0),
        ("7 · "+finish[0],finish[1],0),
        ("8 · קירור ופריסה","קרר, חמם מחדש בקיטור, פרוס דק נגד הסיבים.",0),
      ])

def b_shawarma(meat, season, note, variants, poultry=False):
    return dict(intro=note,
      calc=None,
      materials=["שיפוד אנכי/גריל מסתובב", "פרוסות בשר דקות + שומן כבש לשכבות", "תערובת תיבול: "+season, "סכין חדה / פורסת"],
      variants=variants,
      phases=[
        ("1 · פריסה דקה","פרוס פרוסות אחידות 3–5 מ״מ. אחידות = גילוח אחיד.",0),
        ("2 · מרינדה","ערבב "+season+" עם שמן ובצל"+(" ויוגורט" if poultry else "")+". מרינדה במקרר לילה.",0),
        ("3 · בניית שיפוד","השחל לסירוגין שכבת בשר רזה ושכבת שומן, הדק לגליל צפוף, והנח כובע שומן בראש שינטוף וישקה.",0),
        ("4 · בישול עדין (אופ׳)","אפשר לעטוף ולבשל בסו-ויד 74°C/12h ואז להעביר לאש לקרום.",0),
        ("5 · צלייה וסיבוב","צלה ליד אש בינונית תוך סיבוב; השכבה החיצונית מזהיבה.",0),
        ("6 · גילוח מתגלגל","גלח את החוץ הפריך, חשוף את הבא והמשך."+(" ודא 74°C פנימי." if poultry else "")+" הגש מיד.",0),
      ])

# ---- Fresh sausages ----
make("m-brat","בראטוורסט","Bratwurst","נקניקיות",2, b_fresh(
  "חזיר 80% + עגל 20%","שרוול חזיר 32 מ״מ","אגוז מוסקט, ג׳ינג׳ר יבש, פלפל לבן, גרידת לימון",
  ("צלייה/בישול","בשל באמבט 72°C או צלה על גריל בינוני עד זהוב; הגש בלחמנייה עם חרדל."),
  "נקניק גרמני קלאסי, עדין ומתובל בעדינות. טרי — ללא ריפוי.",
  [("נירנברג","קטן ודק (שרוול כבש 22 מ״מ), מיורן בולט."),("טירינגר","גס יותר, כמון וקצת שום.")]))
make("m-weiss","וייסוורסט","Weisswurst","נקניקיות",3, b_fresh(
  "עגל 60% + חזיר 40% (לבן)","שרוול חזיר 32 מ״מ","פטרוזיליה, גרידת לימון, אגוז מוסקט, הל",
  ("הרתחה עדינה","אל תצלה! חמם במים 70–75°C ~10 דק׳. הגש עם חרדל מתוק ובייגלה."),
  "נקניק לבן בווארי עדין; אמולסיה קלה, מוגש מבושל במים ולא צלוי.",
  [("קלאסי מינכן","עם פטרוזיליה ולימון, ללא ריפוי — לאכילה טרייה.")]) )
make("m-ital","נקניק איטלקי","Italian Sausage","נקניקיות",2, b_fresh(
  "חזיר 80/20","שרוול חזיר 32 מ״מ","זרעי שומר (fennel), פלפל גס, שום, יין אדום",
  ("צלייה","צלה או אפה; מצוין ברוטב עגבניות או על האש."),
  "נקניק איטלקי קלאסי — שומר ויין נותנים את הזהות.",
  [("מתוק (Dolce)","שומר ובזיליקום, ללא חריף."),("חריף (Piccante)","תוספת פתיתי צ׳ילי ופפריקה חריפה.")]) )
make("m-toul","טולוז","Toulouse","נקניקיות",2, b_fresh(
  "חזיר גס","שרוול חזיר 32–36 מ״מ","שום, יין לבן, אגוז מוסקט, פלפל",
  ("קונפי/צלייה","מצוין לקסולה, או צלייה איטית. שמור על מרקם נתחי."),
  "נקניק כפרי צרפתי בטחינה גסה (10 מ״מ) למרקם בשרני.",
  [("קלאסי","שום ויין לבן, פשוט ובשרי.")] )) 
make("m-chip","צ׳יפולטה / ברקפסט","Breakfast Sausage","נקניקיות",1, b_fresh(
  "חזיר 70/30 + פירורי לחם","שרוול כבש 22–24 מ״מ","מרווה, טימין, אגוז מוסקט, פלפל לבן",
  ("טיגון/צלייה","טגן במחבת עד זהוב — קלאסיקה לארוחת בוקר אנגלית."),
  "נקניק בוקר בריטי דק; פירורי הלחם נותנים מרקם רך אופייני.",
  [("קמברלנד","ארוך וספירלי, פלפל גס."),("לינקולנשייר","מרווה דומיננטית.")]) )
make("m-merg","מרגז","Merguez","נקניקיות",2, b_fresh(
  "טלה (או טלה+בקר) 20% שומן","שרוול כבש 22 מ״מ","הריסה, כמון, כוסברה, שום, פפריקה חריפה",
  ("צלייה חזקה","צלה מהר על אש גבוהה; אדום, חריף ועסיסי."),
  "נקניק כבש צפון-אפריקאי חריף ואדום; דק ומהיר לצלייה.",
  [("טוניסאי","הריסה ושום בולטים."),("מעושן","תוספת פפריקה מעושנת.")]) )
make("m-chick","נקניק עוף-צ׳ילי","Chicken Sausage","נקניקיות",2, b_fresh(
  "ירך עוף + 15% עור/שומן","שרוול חזיר 28–32 מ״מ","צ׳ילי, שום, כוסברה, ליים, כמון",
  ("צלייה","צלה עד 74°C פנימי (עוף). דורש לישה ארוכה יותר ללכידות."),
  "נקניק עוף רזה — לישה נמרצת מפצה על מיעוט השומן.",
  [("חריף-מקסיקני","צ׳יפוטלה וכוסברה."),("ים-תיכוני","זעתר, לימון ושום.")], salt=16) )

# ---- Emulsion / cooked-smoked ----
make("m-frank","פרנקפורטר / וינר","Frankfurter","נקניק מעושן",3, b_emul(
  "חזיר + בקר","שרוול כבש 24 מ״מ","פפריקה, שום, חרדל, אגוז מוסקט","72°C",
  "הנקניק החם הקלאסי — אמולסיה דקה, עישון קל ובישול עדין.",
  [("וינאי","עדין, פפריקה ושום."),("הוט-דוג אמריקאי","עשן עדין יותר, מתוק קלות.")]) )
make("m-morta","מורטדלה","Mortadella","נקניק מעושן",4, b_emul(
  "חזיר (עם קוביות שומן גב + פיסטוק)","שרוול גדול 80–100 מ״מ","פלפל לבן, מיורן, פיסטוק, קוביות שומן","70°C",
  "נקניק בולוניז ענק ועדין; קוביות שומן לבנות ופיסטוק זרועים באמולסיה.",
  [("קלאסית","פיסטוק וקוביות שומן."),("טרטופו","תוספת ארומת כמהין.")]) )
make("m-bolo","בולוניה","Bologna","נקניק מעושן",3, b_emul(
  "בקר + חזיר","שרוול פיברי 60–80 מ״מ","פלפל לבן, כוסברה, שום, אגוז מוסקט","70°C",
  "נקניק אמולסיה אמריקאי חלק לפריסה דקה לכריכים.",
  [("רגיל","חלק ועדין."),("מעושן","עישון מודגש יותר.")]) )
make("m-snack","סנאק-סטיקס","Snack Sticks","נקניק מעושן",3, sausage_smoked(
  "בקר + חזיר (טחינה דקה)","Cure #1 2.5 ג׳/ק״ג","שרוול קולגן דק 17–21 מ״מ","עישון מדורג 55°C→75°C","68°C",
  "מקלוני נשנוש דקים ומעושנים, עם 'סנאפ' — דומה לסלמי אך מבושל.",
  [("קלאסי","פלפל, שום, חרדל."),("חריף","ג׳לפיניו וגבינה."),("טריאקי","סויה, ג׳ינג׳ר ושום.")]) )

# ---- Dry / fermented ----
make("m-sopr","סופרסטה","Soppressata","נקניק מיובש",4, sausage_dry(
  "חזיר גס + שומן","Cure #2","שרוול בקר 50–60 מ״מ","חם ולח 24–48 שעות","3–6 שבועות",
  "סלמי איטלקי דרומי בטחינה גסה; לעיתים נלחץ לצורה שטוחה.",
  [("קלברי (חריף)","פפריקה חריפה ופלפל גס."),("מתוק","פלפל שחור ושום בלבד.")]) )
make("m-sauci","סוסיסון סק","Saucisson Sec","נקניק מיובש",4, sausage_dry(
  "חזיר 70 + שומן 30","Cure #2","שרוול חזיר 40–55 מ״מ","חם ולח 24–48 שעות","4–6 שבועות",
  "סלמי צרפתי יבש קלאסי; פלפל ושום, לעיתים יין אדום.",
  [("קלאסי","פלפל גס ושום."),("aux noisettes","תוספת אגוזי לוז.")]) )
make("m-cacc","קצ׳טורה","Cacciatore","נקניק מיובש",3, sausage_dry(
  "חזיר","Cure #2","שרוול חזיר 36–40 מ״מ","חם ולח 24 שעות","2–3 שבועות (קצר — דק)",
  "סלמי 'ציידים' קטן ונייד; מיובש מהר יחסית בזכות הקוטר הקטן.",
  [("קלאסי","פלפל, שום ויין.")] )) 
make("m-nduja","נדוחה",'Nduja',"נקניק מיובש",4, sausage_dry(
  "חזיר שומני מאוד (~50% שומן)","Cure #2","שרוול בקר רחב","חם ולח 24–48 שעות","2–4 שבועות",
  "סלמי קלברי רך הניתן למריחה; עתיר פפריקה חריפה ושומן — מתרכך למרקם משחתי.",
  [("קלאסי","המון פפריקה חריפה קלברית; מורחים על לחם.")]) )
make("m-droe","דרוורס","Droëwors","נקניק מיובש",2, dict(
  intro="נקניק כבש/בקר דרום-אפריקאי דק ומיובש מהר, בן-דוד של בילטונג; ללא התססה — חומץ ותבלינים.",
  calc=dict(salt=26,cure="1",cureRate=2.5,sugar=0,water=0,brine=False,saltL=0,cureL=0,sugarL=0),
  materials=["מטחנה + מכשיר מילוי","שרוול כבש 22 מ״מ","מלח 26 ג׳/ק״ג + חומץ","כוסברה קלויה, פלפל, כמון, ציפורן","ארון ייבוש מאוורר"],
  variants=[("קלאסי","כוסברה דומיננטית, חומץ תפוחים.")],
  phases=[
    ("1 · בשר ושומן","בקר/כבש עם ~20% שומן; טחינה גסה 6–8 מ״מ.",0),
    ("2 · תיבול","מלח 26 ג׳/ק״ג, חומץ, כוסברה קלויה גרוסה ותבלינים. ערבב קצר.",0),
    ("3 · מילוי","מלא לשרוול כבש דק 22 מ״מ; דקור בועות.",0),
    ("4 · תלייה","תלה בארון מאוורר בטמפ׳ חדר קרירה, ללא מגע בין הנקניקים.",0),
    ("5 · ייבוש (1–3 ימים)","דק ומהיר — מוכן כשיבש בחוץ ועדיין מעט גמיש בפנים.",0),
  ]))

# ---- Pastrami family ----
make("p-ny","פסטרמה ניו-יורק","NY Pastrami","פסטרמה",4, b_pastrami(
  "בריסקט (point)","5–7 ימים","עשן ב-110–120°C עד ~70–75°C פנימי (אלון/היקורי).",
  ("אידוי לרכות","אדה ~1–2 שעות עד ~96°C פנימי — נחתך כמו חמאה."),
  "הקלאסיקה: בריסקט כבוש, ציפוי כוסברה-פלפל כבד, עישון ואידוי.",
  [("רזה (flat)","פחות שומן, פרוסות אחידות."),("שמן (point)","עסיסי ומתפורר.")]) )
make("p-mont","מונטריאול סמוקד מיט","Montreal Smoked Meat","פסטרמה",4, b_pastrami(
  "בריסקט","7–9 ימים (כבישה ארוכה)","עשן ב-105–115°C; פחות סוכר, יותר פלפל ושום.",
  ("אידוי","אדה עד ~95°C פנימי, רך ולח."),
  "בן-הדוד הקנדי — מתובל יותר בפלפל ושום, מתוק פחות.",
  [("קלאסי","פלפל-שום דומיננטי.")]) )
make("p-turkey","פסטרמה הודו","Turkey Pastrami","פסטרמה",3, b_pastrami(
  "חזה הודו","2–3 ימים (כבישה קצרה)","עשן ב-105–110°C עד 74°C פנימי (עוף).",
  ("מנוחה","אין צורך באידוי ארוך; נוח, קרר ופרוס דק."),
  "גרסה רזה ובריאה; כבישה קצרה ועישון עד טמפ׳ בטיחות עוף.",
  [("עדין","כוסברה-פלפל קלאסי."),("חריף","תוספת פפריקה חריפה.")]) )
make("p-deckel","פסטרמה דקל","Deckel Pastrami","פסטרמה",4, b_pastrami(
  "דקל / מכסה צלעות בקר","5–7 ימים","עשן ב-110°C עד ~75°C פנימי.",
  ("אידוי","אדה עד ~95°C — הדקל השומני הופך נימוח."),
  "נתח שומני ועשיר במיוחד (מכסה הצלע); תוצאה דקדנטית.",
  [("קלאסי","כוסברה-פלפל, עישון אלון.")]) )
make("p-lamb","פסטרמה טלה","Lamb Pastrami","פסטרמה",4, b_pastrami(
  "כתף טלה","4–6 ימים","עשן ב-110°C עד ~90°C פנימי (קולגן).",
  ("אידוי קצר","אדה עד רכות; הטעם עז ואופייני."),
  "פסטרמת טלה ארומטית — ציפוי כוסברה-כמון מתאים לבשר.",
  [("מזרח-תיכוני","תוספת כמון ושום לציפוי.")]) )
make("p-bast","בּסטירמה (טורקית)","Pastırma","פסטרמה",5, dict(
  intro="בּסטירמה — בשר בקר מיובש-אוויר טורקי, מצופה בצֶ'מֶן (פסטת חילבה, שום ופפריקה). ללא עישון; ריפוי, לחיצה וייבוש ממושך. ⚠ דורש בקרת תנאים.",
  calc=dict(salt=0,cure=None,sugar=0,water=0,brine=False,saltL=0,cureL=0,sugarL=0),
  materials=["נתח בקר רזה (שייטל/אנטריקוט)","מלח גס לכבישה יבשה + Cure #2","משקולת ללחיצה","צֶ'מֶן: חילבה טחונה + שום כתוש + פפריקה + כמון + מים","ארון ייבוש מאוורר"],
  variants=[("קלאסית","צ׳מן עבה, פפריקה אדומה דומיננטית.")],
  phases=[
    ("1 · כבישה יבשה","כסה את הנתח במלח גס (+Cure #2) 3–5 ימים במקרר; הופך ומנקז נוזלים.",0),
    ("2 · שטיפה ולחיצה","שטוף, ייבש, ולחץ תחת משקולת יום-יומיים להוצאת לחות ולצורה שטוחה.",0),
    ("3 · ייבוש ראשון","תלה בארון מאוורר קריר ~1–2 שבועות עד שהחוץ מתקשה.",0),
    ("4 · מריחת צֶ'מֶן","ערבב חילבה+שום+פפריקה+כמון+מים לפסטה, ומרח שכבה עבה על כל הנתח.",0),
    ("5 · ייבוש סופי","המשך ייבוש ~1–2 שבועות עד שהצ׳מן יבש והבשר מוצק לאורך החתך.",0),
    ("6 · פריסה","פרוס דק מאוד; הגש כמות שהיא או בביצים/מנגל.",0),
  ]))

# ---- Shawarma family ----
make("s-turkey","שווארמה הודו","Turkey Shawarma","שווארמה",3, b_shawarma(
  "פרגיות/שוקי הודו + שומן כבש","בהרט, כורכום, הל, פפריקה, שום, לימון",
  "הקלאסיקה הישראלית — הודו עסיסי עם שכבות שומן כבש.",
  [("ישראלי","בהרט ושום, שומן כבש נדיב."),("חריף","תוספת פלפל אדום וצ׳ילי.")], poultry=True) )
make("s-lamb","שווארמה טלה/בקר","Lamb/Beef Shawarma","שווארמה",4, b_shawarma(
  "אנטריקוט/שפונדרה + שומן אליה","בהרת, כמון, קינמון, פלפל אנגלי, שום",
  "שווארמה ערבית עשירה ובשרית; שומן אליה לעסיסיות.",
  [("לבנוני","שבעת התבלינים וקינמון."),("עיראקי","עמבה ובהרת עיראקי בהגשה.")]) )
make("s-chicken","שווארמה עוף","Chicken Shawarma","שווארמה",2, b_shawarma(
  "ירך+חזה עוף","יוגורט, שום, לימון, פפריקה, כמון, כורכום",
  "מרינדת יוגורט מרככת ומשחימה; קלה ופופולרית.",
  [("ביתי","יוגורט-שום-לימון."),("טורקי (טאבוק דונר)","תוספת פפריקה ופלפל אדום.")], poultry=True) )
make("s-iraqi","שווארמה כבש עיראקית","Iraqi Lamb","שווארמה",4, b_shawarma(
  "כבש + שומן אליה","בהרת עיראקי (הל שחור, לומי, כמון), שום, פלפל",
  "כבש ארומטי עם בהרת עיראקי; מוגש עם עמבה ועגבניות צרובות.",
  [("קלאסי","עמבה, סלט, פיתה עיראקית.")]) )
make("s-mixed","שווארמה מעורבת","Mixed Meat","שווארמה",4, b_shawarma(
  "בקר + טלה + הודו לסירוגין","בהרט, פפריקה מעושנת, שום, פלפל אנגלי",
  "שיפוד 'דוכן' קלאסי — שכבות בשרים שונים לעומק טעם; שומן בין השכבות.",
  [("דוכן רחוב","שילוב בקר-הודו-שומן כבש, גילוח שכבתי.")]) )

# ---- Romanian / Balkan additions (user request) ----
make("m-mici","מיצ׳י / מיטיטֵיי","Mici / Mititei","נקניקיות",2, dict(
  intro="מיצ׳י (מיטיטֵיי, 'הקטנטנים') — נקניקיות רומניות **ללא שרוול**, מהמאכלים האהובים בבלקן (≈440 מיליון נאכלים ברומניה בשנה). הסוד: סודה לשתייה ומרק בקר ללישה שנותנת מרקם אוורירי ועסיסי. בני-דוד של צ׳בפי וקבב.",
  calc=dict(salt=16,cure=None,sugar=0,water=0,brine=False,saltL=0,cureL=0,sugarL=0,cureRate=2.5),
  materials=["מטחנה (פלטה 4–6 מ״מ)","קערת לישה + מקרר","בקר + חזיר/טלה, ~20–30% שומן","שום, צ׳ימברו (savory/צתרה), כוסברה, פלפל שחור, פפריקה, פלפל אנגלי","סודה לשתייה (~1 כפית/ק״ג) + מרק בקר/מים מוגזים","מלח ~16 ג׳/ק״ג"],
  variants=[("בקר-חזיר קלאסי","היחס הנפוץ ברומניה; שום ופלפל בולטים."),("בקר-טלה","עשיר וארומטי יותר (הגרסה ההיסטורית)."),("צ׳בפי בלקני","בקר/טלה בלבד, פחות תבלין; מוגש עם בצל וקאימאק.")],
  phases=[
   ("1 · בשר ושומן","בליל בקר + חזיר (או טלה) עם 20–30% שומן — לב לעסיסיות.",0),
   ("2 · טחינה","טחן פעם-פעמיים בפלטה 4–6 מ״מ; שמור קר.",0),
   ("3 · תיבול","שום כתוש (נדיב!), צ׳ימברו (או צתרה/טימין), כוסברה טחונה, פלפל שחור, פפריקה, פלפל אנגלי, מלח ~16 ג׳/ק״ג.",0),
   ("4 · סודה ומרק","המס סודה לשתייה במעט מרק בקר קר/מים מוגזים והוסף לבשר — נותן אווריריות, עסיסיות וצבע יציב.",0),
   ("5 · לישה עד עיסה","לוש נמרצות עד עיסה דביקה אחידה (חילוץ חלבון מלכד); דחוס החוצה בועות אוויר.",0),
   ("6 · מנוחה (לילה)","כסה וצנן 6–12 שעות, עדיף לילה — שלב קריטי לטעם ולמרקם.",0),
   ("7 · עיצוב","בידיים רטובות עצב גלילים ~8–10 ס״מ × 2.5 ס״מ (מתכווצים בצלייה — עשה ארוכים). אפשר בשקית זילוף.",0),
   ("8 · צלייה","צלה על פחם בחום בינוני-גבוה; הפוך רק כשמשתחררים לבד (~3–4 דק׳/צד). הגש מיד עם חרדל, לחם ובירה קרה.",300),
  ]))
make("m-carnati","קרנאצי דה קאסה","Cârnați de Casă","נקניקיות",2, b_fresh(
  "חזיר (כתף/בטן) + בייקון מעושן גרוס","שרוול חזיר 32 מ״מ","שום (הרבה!), פלפל שחור גס, צ׳ימברו (savory), מעט מרק/יין; אופ׳ תימין",
  ("צלייה/טיגון","צלה או טגן בחום בינוני עד קרום זהוב-פריך. מוגש עם ממליגה, חרדל וחמוצים."),
  "נקניק בית רומני מסורתי — שום דומיננטי, צ׳ימברו, ועשן עדין שמגיע מבייקון מעושן בתוך הבליל. טחינה גסה, גולמי וכפרי.",
  [("קלאסי","שום + צ׳ימברו + פלפל; בייקון מעושן בבליל."),("אולטֶני (חריף)","תוספת פפריקה חריפה ושום קלוי.")], salt=20))
make("m-patricieni","קרנאצי פטריצ׳ני","Patricieni","נקניקיות",2, b_fresh(
  "חזיר 80/20 (טחינה דקה)","שרוול כבש/חזיר דק 22–26 מ״מ","שום עדין, פלפל לבן, מעט פפריקה, מרק — דק וחלק",
  ("צלייה","צלה מהר על האש עד פריך; קלאסיקה של דוכני הגריל הרומניים, לצד מיצ׳י."),
  "פטריצ׳ני — נקניק רומני **דק** וחלק יחסית (סגנון פרנקפורטר-גריל), נמכר בדוכני רחוב לצד מיצ׳י.",
  [("קלאסי","דק, שום עדין, פלפל לבן ופפריקה.")], salt=18))

# ===========================================================================
# EXPANSION PACK (user approved full gaps list): salumi, regional sausages,
# smoked fish, BBQ classics, ground-grill kebabs
# ===========================================================================

def b_salumi(meat, cure_days, spice, dry, note, variants, smoked=False):
    mats=["נתח שלם: "+meat, "מלח ~30 ג׳/ק״ג (3%) + Cure #2 2.5 ג׳/ק״ג", "תבלינים: "+spice,
          "שקית ואקום (equilibrium) / מיכל כבישה", "רשת או חוט קשירה", "תא הבשלה 12–15°C / 70–80% לחות + מאזניים"]
    if smoked: mats.append("מעשנת/מחולל עשן לעישון קר ≤25°C")
    phases=[
      ("1 · בחירת נתח ושקילה","בחר "+meat+" טרי ונקי; גזום קרומים ועודף שומן חיצוני. **שקול ורשום משקל יעד = ×0.62–0.65** (ירידת 35–40%).",0),
      ("2 · ריפוי (equilibrium)","שפשף מלח 3% + Cure #2 2.5 ג׳/ק״ג + "+spice+". סגור בוואקום (equilibrium — מדויק ובטוח) או כבישה יבשה פתוחה.",0),
      ("3 · כבישה ("+cure_days+")","במקרר, הפוך יומית. equilibrium מבטיח ריפוי אחיד לכל העובי.",0),
      ("4 · גיבוש וקשירה","שטוף עודפי מלח, ייבש, ועטוף בבד/collagen או השחל לרשת ייבוש. לקופה/פנצ'טה — אפשר לגלגל הדוק ולקשור בחוט.",0),
      (("5 · עישון קר" if smoked else "5 · ייבוש ראשוני"),
       ("עשן קר ≤25°C ב-2–3 מחזורים (אלפיני), ואז העבר לייבוש." if smoked else "תלה בתא 12–15°C ולחות 80% ל-2–3 ימים ראשונים."),0),
      ("6 · הבשלה ("+dry+")","ייבש ב-**12–15°C ולחות 70–80%** עם מאוורר מחזורי, עד שמשקל היעד מושג (Aw≈0.85). הימנע מ-case hardening (קליפה קשה/מרכז רטוב).",0),
      ("7 · בדיקה ופריסה","מוכן כשמוצק ואחיד לאורך החתך (עובש לבן רצוי). פרוס **דק מאוד** — אנטיפסטי, כריך, או לוח קרשים.",0),
    ]
    return dict(intro=note+" ⚠ נתח-שלם מיובש לא מבושל — בקרת מלח, טמפ׳ ולחות קריטית. עבוד נקי ובמדויק.",
      calc=dict(salt=30,cure="2",sugar=0,water=0,brine=False,saltL=0,cureL=0,sugarL=0,cureRate=2.5),
      materials=mats, variants=variants, phases=phases)

# --- Salumi (whole-muscle) ---
make("sal-bresaola","ברזאולה","Bresaola","סלומי",4, b_salumi(
  "בקר רזה (שייטל / אוז / פילה)","7–10 ימים","ערער, שחור גס, שום, רוזמרין + יין אדום","3–4 שבועות",
  "ברזאולה — בקר רזה מיובש מלומברדיה, אדום-עמוק ועדין; טעמו הושווה לפסטרמה. מוגש דק עם שמן זית ולימון.",
  [("קלאסית","ערער ופלפל; יין אדום."),("מחיית בר","מצבי/בקר בר, ארומה עמוקה יותר.")]))
make("sal-coppa","קופה / קפיקולה","Coppa","סלומי",4, b_salumi(
  "צוואר חזיר (capocollo)","7–14 ימים","פלפל, אגוז מוסקט, קינמון/ציפורן + יין","6–8 שבועות",
  "קופה — צוואר חזיר משויש מיובש, 'הפרושוטו של העני'. מתובל לעיתים בתבלינים חמים-מתוקים.",
  [("דולצ'ה","עדינה, פלפל ותבלינים מתוקים."),("פיקנטה","תוספת פפריקה חריפה.")]))
make("sal-pancetta","פנצ'טה","Pancetta","סלומי",3, b_salumi(
  "בטן חזיר","7 ימים","פלפל גס, שום, ערער, רוזמרין, עלי דפנה","2–3 שבועות (מגולגלת arrotolata)",
  "פנצ'טה — 'הבייקון האיטלקי' שאינו מעושן; מלח ועשבים בלבד. נהדרת בפסטה, סלט או על קרש.",
  [("ארוטולטה (מגולגלת)","מגולגלת הדוק וקשורה — פרוסות עגולות."),("סטֵסה (שטוחה)","שטוחה, קלה לקוביות."),("אפומיקטה","גרסה מעושנת קלות.")]))
make("sal-guanciale","גואנצ'אלה","Guanciale","סלומי",3, b_salumi(
  "לחי חזיר (jowl)","5–7 ימים","פלפל שחור גס, רוזמרין, שום, מעט מרווה","3 שבועות",
  "גואנצ'אלה — לחי חזיר מיובשת, עשירה ונימוחה; חיונית לקרבונרה ולאמטריצ'אנה אמיתיות.",
  [("רומאי קלאסי","פלפל גס דומיננטי, ללא עשן.")]))
make("sal-lonzino","לונזינו","Lonzino","סלומי",3, b_salumi(
  "פילה חזיר (loin)","5–7 ימים","מלח, פלפל, שום, עשבי תיבול (+ יין)","3–4 שבועות",
  "לונזינו — פילה חזיר רזה מיובש, עדין ומתון; פריסה דקה לאנטיפסטי.",
  [("קלאסי","עשבים ויין לבן."),("מפולפל","ציפוי פלפל גס חיצוני.")]))
make("sal-speck","שפק","Speck","סלומי",4, b_salumi(
  "ירך חזיר ללא עצם (פרוס/שטוח)","7 ימים","ערער, פלפל, שום, עלי דפנה","2–4 שבועות",
  "שפק — ירך חזיר אלפיני מיובש **ומעושן קר** (טירול); בין פרושוטו לבייקון. דק ונהדר עם לחם.",
  [("טירולי קלאסי","עישון קר עדין באלון/בכר + ערער.")], smoked=True))

# --- Regional sausages ---
make("m-sucuk","סוּג'וּכּ / סוג'וק","Sucuk","נקניק מיובש",4, sausage_dry(
  "בקר (+ שומן זנב כבש)","Cure #2","שרוול בקר 38–45 מ״מ","חם ולח 24–48 שעות","2–4 שבועות",
  "סוג'וק — נקניק בקר טורקי/מזרח-תיכוני מיובש, חריף-ארומטי: שום, כמון, סומק ופפריקה. מטוגן עם ביצים או על האש.",
  [("טורקי קלאסי","כמון, סומק, שום, צ'מן (חילבה), פפריקה חריפה.")]))
make("m-loukaniko","לוקאניקו","Loukaniko","נקניק מעושן",3, sausage_smoked(
  "חזיר (כתף/בטן)","Cure #1 2.5 ג׳/ק״ג","שרוול חזיר 32 מ״מ","עישון קל 60°C→70°C עם עצי פרי","68°C",
  "לוקאניקו — נקניק חזיר יווני עם **גרידת תפוז וזרעי שומר (fennel)**, מעושן קלות; לעיתים טבול ביין.",
  [("קלאסי","תפוז, שומר, אורגנו, יין אדום."),("חריף","תוספת פפריקה חריפה.")]))
make("m-boerewors","בוארוורס","Boerewors","נקניקיות",2, b_fresh(
  "בקר + חזיר/טלה (גס), ~25% שומן","שרוול חזיר רחב 32–38 מ״מ (סליל ארוך)","כוסברה קלויה (דומיננטית!), חומץ, אגוז מוסקט, ציפורן, פלפל אנגלי",
  ("צלייה (braai)","צלה את הסליל השלם על פחם בחום בינוני, הפוך בעדינות; לא לנקב — שומר עסיסיות."),
  "בוארוורס — נקניק דרום-אפריקאי טרי בצורת **סליל ספירלי**, כוסברה-חומץ אופייניים; כוכב ה-Braai.",
  [("קלאסי","כוסברה+חומץ+תבלינים חמים."),("חריף","תוספת צ'ילי ושום קלוי.")], salt=18))
make("m-linguica","לינגוויסה","Linguiça","נקניק מעושן",3, sausage_smoked(
  "חזיר (כתף)","Cure #1 2.5 ג׳/ק״ג","שרוול חזיר 32 מ״מ","עישון 60°C→75°C עם אלון/היקורי","68°C",
  "לינגוויסה — נקניק חזיר פורטוגלי מעושן, **פפריקה מעושנת (pimentão), שום ויין**; אדמדם וארומטי.",
  [("פורטוגלי קלאסי","פפריקה מתוקה, שום, יין לבן, עלי דפנה."),("שוריסו","יותר פפריקה ופלפל חריף.")]))
make("m-lapcheong","לאפ צ'ונג","Lap Cheong","נקניק מיובש",3, dict(
  intro="לאפ צ'ונג — נקניק חזיר סיני **מתוק ומיובש**: סויה, יין אורז (שאוסינג), סוכר ושומן בקוביות. מאודה/מטוגן באורז מטוגן ובתבשילים.",
  calc=dict(salt=20,cure="1",sugar=40,water=0,brine=False,saltL=0,cureL=0,sugarL=0,cureRate=2.5),
  materials=["מטחנה גסה + מכשיר מילוי","שרוול חזיר דק 22–26 מ״מ","מלח + Cure #1 2.5 ג׳/ק״ג + סוכר רב (~4%)","סויה כהה, יין אורז שאוסינג, (אופ׳ רוז ביילו)","מקום ייבוש מאוורר חמים/יבש"],
  variants=[("קלאסי קנטונזי","סויה, שאוסינג, סוכר; יחס רזה:שומן ~3:1.")],
  phases=[
    ("1 · בשר ושומן","חזיר רזה בקוביות + שומן גב בקוביות (~25%) — לא טוחנים דק; רוצים מרקם 'מנומר'.",0),
    ("2 · מרינדה","ערבב עם סויה, יין אורז, סוכר, מלח ו-Cure #1; השרה 4–12 שעות במקרר.",0),
    ("3 · מילוי","מלא לשרוול דק 22–26 מ״מ, קשור ללינקים קצרים, דקור בועות.",0),
    ("4 · ייבוש","תלה במקום מאוורר חמים-יבש (או מייבש ~40–50°C) ~3–7 ימים עד נוקשה ומבריק.",0),
    ("5 · אחסון ובישול","אחסן במקרר/מקפיא. לפני אכילה — אדה או טגן (נמס ומשחרר ארומה מתוקה).",0),
  ]))

# --- Smoked fish ---
make("fish-lox","לקס (סלמון בעישון קר)","Cold-Smoked Salmon","דג מעושן",4, dict(
  intro="לקס — פילה סלמון כבוש ואז **מעושן קר** ≤25°C, חלק ומשיי. שונה מגרבלקס (ללא עישון) ומסלמון מעושן חם.",
  calc=dict(salt=40,cure=None,sugar=40,water=0,brine=False,saltL=0,cureL=0,sugarL=0,cureRate=2.5),
  materials=["פילה סלמון **סושי-גרייד / שהוקפא** (-20°C, 7 ימים — בטיחות טפילים)","מלח גס + סוכר (1:1) לכבישה","מחולל עשן (tube) + עצי פרי","מקרר + מעשנת קרה"],
  variants=[("קלאסי","מלח-סוכר, שמיר; עישון אלון/אגוז."),("ערער-הדרים","ערער וגרידת לימון בכבישה.")],
  phases=[
    ("1 · בטיחות טפילים","חובה דג סושי-גרייד או שהוקפא -20°C ל-7 ימים — עישון קר אינו הורג טפילים.",0),
    ("2 · כבישה יבשה","כסה בתערובת מלח-סוכר (1:1) + שמיר, 12–24 שעות במקרר עד שהבשר מתהדק.",0),
    ("3 · שטיפה ו-Pellicle","שטוף, ייבש, והנח גלוי במקרר 4–12 שעות עד משטח דביק-מבריק (קולט עשן).",0),
    ("4 · עישון קר","עשן ≤25°C (עדיף לילה/קרח) 4–12 שעות לפי עוצמה רצויה. הסלמון נשאר 'נא' במרקם.",0),
    ("5 · מנוחה ופריסה","עטוף וקרר 24 שעות להתמתנות, ואז פרוס דק מאוד בזווית. במקרר עד ~שבוע.",0),
  ]))
make("fish-mackerel","מקרל מעושן","Smoked Mackerel","דג מעושן",2, dict(
  intro="מקרל מעושן — דג שומני בכבישה קצרה ואז **עישון חם** ~80°C; עשיר, מעושן ומוכן לאכילה.",
  calc=None,
  materials=["מקרל שלם/פילה טרי","תמלחת ~6% מלח (+ סוכר חום, פלפל, דפנה)","מעשנת ~80°C + עצי פרי/אלון","מדחום"],
  variants=[("קלאסי","תמלחת מלח-סוכר; עישון אלון/תפוח."),("פלפלי","ציפוי פלפל גס לאחר העישון.")],
  phases=[
    ("1 · כבישה (תמלחת)","השרה בתמלחת ~6% מלח 1–3 שעות (לפי גודל) במקרר.",0),
    ("2 · Pellicle","שטוף, ייבש, והנח גלוי במקרר 1–2 שעות עד משטח דביק.",3600),
    ("3 · עישון חם","עשן ~80°C עם עצי פרי/אלון עד טמפ׳ פנימית 63°C והבשר מתקלף (~1–2 שעות).",0),
    ("4 · קירור","קרר והגש; מצוין במטבלים, סלטים או על לחם. במקרר עד 3–4 ימים.",0),
  ]))
make("fish-gravlax","גרבלקס","Gravlax","דג מעושן",2, dict(
  intro="גרבלקס — סלמון נורדי כבוש במלח, סוכר ושמיר **ללא עישון וללא חום**. החומרים 'מבשלים' אותו בכבישה.",
  calc=dict(salt=40,cure=None,sugar=40,water=0,brine=False,saltL=0,cureL=0,sugarL=0,cureRate=2.5),
  materials=["פילה סלמון **סושי-גרייד / שהוקפא**","מלח גס + סוכר (1:1)","המון שמיר טרי","אופ׳: גרידת לימון, ערק/ג'ין, סלק (לצבע)"],
  variants=[("קלאסי","מלח-סוכר-שמיר."),("סלק-ג'ין","סלק מגורר וג'ין — צבע ורוד וארומה."),("הדרים","גרידת תפוז/לימון ופלפל ורוד.")],
  phases=[
    ("1 · בטיחות","דג סושי-גרייד או שהוקפא -20°C/7 ימים.",0),
    ("2 · ציפוי","כסה את הפילה בתערובת מלח-סוכר ושמיר משני הצדדים.",0),
    ("3 · כבישה בלחיצה","עטוף, הנח משקולת, וקרר 24–72 שעות — הפוך ונקז נוזלים פעם ביום.",0),
    ("4 · ניקוי ופריסה","גרד את הכבישה, נגב, ופרוס **דק מאוד** בזווית. הגש על לחם עם חרדל-שמיר.",0),
  ]))

# --- BBQ classics ---
make("bbq-burntends","Burnt Ends","Brisket Burnt Ends","BBQ קלאסי",3, dict(
  intro="Burnt Ends — קוביות מ**פוינט הבריסקט** המעושן, מצופות רוטב וסוכר וחוזרות למעשנת ל'ממתק בשר' דביק-מקורם.",
  calc=None,
  materials=["פוינט בריסקט (החלק השמן)","ראב בקר (מלח+פלפל גס)","רוטב BBQ + מעט סוכר חום/דבש","מעשנת 110–120°C + אלון/היקורי","תבנית"],
  variants=[("קלאסי KC","רוטב BBQ מתוק-עשן."),("חריף","תוספת קיין וצ'יפוטלה לרוטב.")],
  phases=[
    ("1 · עישון הפוינט","תבל בראב ועשן ב-110–120°C עד ~75°C פנימי וקרום כהה.",0),
    ("2 · עטיפה לרכות","עטוף והמשך עד ~95°C פנימי (נימוח). נוח קצרות.",0),
    ("3 · חיתוך לקוביות","חתוך לקוביות ~2.5 ס״מ. סלק עודפי שומן לא-נמס.",0),
    ("4 · רוטב וסוכר","ערבב בתבנית עם רוטב BBQ + סוכר חום/דבש.",0),
    ("5 · קרמול חוזר","החזר למעשנת/גריל 30–60 דק׳ עד שהרוטב מסמיך ומקרמל. הגש מיד.",1800),
  ]))
make("bbq-pbburnt","Pork Belly Burnt Ends","Pork Belly Burnt Ends","BBQ קלאסי",2, dict(
  intro="Pork Belly Burnt Ends — קוביות בטן חזיר מעושנות, מתוקות-דביקות; קלות יותר מבריסקט ומכורות-קהל.",
  calc=None,
  materials=["בטן חזיר (קוביות 4 ס״מ)","ראב מתוק (חום+פפריקה)","חמאה + סוכר חום + דבש/סילאן + רוטב BBQ","מעשנת 110°C + תפוח/היקורי"],
  variants=[("מתוק קלאסי","חמאה-סוכר-דבש."),("אסייתי","גלייז הויסין-סויה-ג'ינג'ר.")],
  phases=[
    ("1 · קוביות וראב","חתוך לקוביות 4 ס״מ, תבל נדיב בראב מתוק.",0),
    ("2 · עישון","עשן ב-110°C ~2.5–3 שעות עד קרום וזהוב.",0),
    ("3 · אמבט מתוק","העבר לתבנית עם חמאה, סוכר חום ודבש; כסה והמשך ~1.5 שעות עד נימוח.",0),
    ("4 · גלייז","גלה, הוסף רוטב BBQ, והמשך 15–30 דק׳ עד שמסמיך ומבריק. הגש מיד.",1800),
  ]))
make("bbq-porchetta","פורקטה","Porchetta","BBQ קלאסי",4, dict(
  intro="פורקטה — רולדת חזיר איטלקית (בטן סביב פילה) עם **שומר, שום ורוזמרין ועור פריך כזכוכית**. צלייה ארוכה.",
  calc=None,
  materials=["בטן חזיר עם עור (+ פילה חזיר במרכז)","שום, זרעי שומר קלויים, רוזמרין, מרווה, גרידת לימון, פלפל","חוט קצבים","מעשנת/תנור (low ואז high לעור)"],
  variants=[("קלאסית","שומר-שום-רוזמרין."),("חריפה","פתיתי צ'ילי ופלפל גס.")],
  phases=[
    ("1 · פתיחה ותיבול","פרוס פתח את הבטן, חרוט את הבשר, ושפשף בפסטת שום-שומר-עשבים-לימון.",0),
    ("2 · גלגול וקשירה","הנח פילה במרכז, גלגל הדוק וקשור כל 2–3 ס״מ. ייבש את העור במקרר לילה (לעור פריך).",0),
    ("3 · צלייה איטית","צלה/עשן ב-130–140°C עד ~70–75°C פנימי (~2–3 שעות).",0),
    ("4 · קרמול עור","העלה ל-220°C+ (או צריבה) עד שהעור מתפצפץ לזכוכית פריכה.",0),
    ("5 · מנוחה ופריסה","נוח 20 דק׳, פרוס לעיגולים עם ליבת בשר ועור פריך. כריך פורקטה קלאסי.",1200),
  ]))
make("bbq-hotlinks","Texas Hot Links","Texas Hot Links","BBQ קלאסי",3, sausage_smoked(
  "בקר + חזיר (גס)","Cure #1 2.5 ג׳/ק״ג","שרוול חזיר 32–35 מ״מ","עישון 110°C עם אלון/פקאן","68°C",
  "טקסס הוט-לינקס — נקניק בקר-חזיר **חריף ומעושן** של מזרח טקסס: קיין, פפריקה, שום ופלפל גס.",
  [("קלאסי טקסני","קיין+פפריקה+שום, גס."),("מאוד חריף","תוספת הבנרו/צ'יפוטלה.")]))

# --- Ground-grill kebabs ---
make("m-kofta","קופטה / קפטה","Kofta","צלייה טחונה",2, dict(
  intro="קופטה — בשר טחון מתובל ללא שרוול, על שיפוד או כקציצות מוארכות. נפוצה בלבנט, טורקיה והודו.",
  calc=dict(salt=16,cure=None,sugar=0,water=0,brine=False,saltL=0,cureL=0,sugarL=0,cureRate=2.5),
  materials=["מטחנה (8 מ״מ)","שיפודים שטוחים / ידיים","טלה או בקר-טלה, ~20% שומן","בצל מגורר וסחוט, פטרוזיליה/כוסברה, פלפל אנגלי, כמון, קינמון, פלפל"],
  variants=[("לבנונית","פטרוזיליה, פלפל אנגלי, קינמון."),("טורקית (אורפה)","פלפל אורפה/איזוט מעושן."),("הודית (סיק)","ג'ינג'ר, גרם מסאלה, צ'ילי.")],
  phases=[
    ("1 · בשר ושומן","טלה/בקר-טלה עם ~20% שומן; טחינה 8 מ״מ.",0),
    ("2 · בצל ותיבול","בצל מגורר וסחוט היטב, עשבים ותבלינים; מלח ~16 ג׳/ק״ג.",0),
    ("3 · לישה ללכידות","לוש עד עיסה דביקה ומלוכדת — כך נצמד לשיפוד ולא נופל.",0),
    ("4 · מנוחה","קרר 1–2 שעות להתייצבות הבליל.",3600),
    ("5 · עיצוב","בידיים רטובות עצב על שיפוד שטוח או כקציצות מוארכות.",0),
    ("6 · צלייה","צלה על פחם חזק תוך סיבוב עד קרום (יעד ~65°C; טחון בטיחות 71°C). הגש בלאפה עם טחינה.",0),
  ]))
make("m-lula","לולה קבב","Lula Kebab","צלייה טחונה",3, dict(
  intro="לולה קבב — קבב טלה אזרבייג'ני/קווקזי על שיפוד רחב, עם שומן אליה ובצל; מינימום תבלינים, מקסימום בשר.",
  calc=dict(salt=16,cure=None,sugar=0,water=0,brine=False,saltL=0,cureL=0,sugarL=0,cureRate=2.5),
  materials=["מטחנה (8 מ״מ) או קציצה ידנית","שיפודים רחבים","טלה + שומן אליה (~25%)","בצל מגורר, מלח, פלפל שחור (לעיתים סומק)"],
  variants=[("אזרי קלאסי","טלה+אליה, בצל, פלפל — נקי ובשרי."),("עם עשבים","תוספת כוסברה ונענע.")],
  phases=[
    ("1 · בשר ושומן","טלה עם שומן אליה ~25%; טחינה גסה או קיצוץ סכין.",0),
    ("2 · בצל ותיבול","בצל מגורר-סחוט, מלח, פלפל. מעט מאוד תבלינים — הבשר הוא הכוכב.",0),
    ("3 · לישה ארוכה","לוש 8–10 דק׳ עד עיסה דביקה ומלוכדת מאוד (קריטי שלא יישמט).",0),
    ("4 · קירור","קרר 2–3 שעות (עדיף) להידוק.",3600),
    ("5 · עיצוב על שיפוד","לחץ הדוק לאורך שיפוד רחב בידיים רטובות; עובי אחיד.",0),
    ("6 · צלייה","צלה מעל פחם חזק תוך סיבוב מהיר עד קרום ולב עסיסי. הגש עם בצל-סומק ולוואש.",0),
  ]))

# recategorize mici/cevapi make into the ground-grill family
if "m-mici" in MAKES: MAKES["m-mici"]["cat"]="צלייה טחונה"

# ── Per-cut doneness levels (internal temp °C = doneness). Research-grounded
# (Baldwin, Anova/Food-Lab, Amazing Food Made Easy). Steak cuts get 4 levels;
# collagen cuts keep their fixed target (no doneness key). Ground/fast cuts skip
# 'rare' for food safety. default = recommended level for that specific cut.
DONENESS = {
  # steak cuts (red meat)
  6:  {"default":"med", "levels":{"rare":{"c":50},"mr":{"c":54},"med":{"c":60},"mw":{"c":64},"well":{"c":68}}},   # פיקאניה — fatty, med default
  11: {"default":"mr",  "levels":{"rare":{"c":50},"mr":{"c":54},"med":{"c":60},"mw":{"c":64},"well":{"c":68}}},   # טומאהוק
  20: {"default":"mr",  "levels":{"rare":{"c":50},"mr":{"c":54},"med":{"c":58},"mw":{"c":62},"well":{"c":66}}},   # טרי-טיפ
  23: {"default":"mr",  "levels":{"rare":{"c":52},"mr":{"c":56},"med":{"c":60},"mw":{"c":64},"well":{"c":68}}},   # אנטריקוט רוסט
  26: {"default":"mr",  "levels":{"rare":{"c":50},"mr":{"c":54},"med":{"c":58},"mw":{"c":62},"well":{"c":66}}},   # סינטה רוסט
  27: {"default":"mr",  "levels":{"rare":{"c":50},"mr":{"c":54},"med":{"c":58},"mw":{"c":62}}},                    # פילה — lean, capped at med
  28: {"default":"mr",  "levels":{"rare":{"c":52},"mr":{"c":56},"med":{"c":60},"mw":{"c":64},"well":{"c":68}}},   # ואסיו
  53: {"default":"med", "levels":{"rare":{"c":52},"mr":{"c":56},"med":{"c":60},"mw":{"c":64},"well":{"c":68}}},   # מכסה אנטריקוט — fatty, med default
  54: {"default":"mr",  "levels":{"rare":{"c":52},"mr":{"c":56},"med":{"c":60},"mw":{"c":63},"well":{"c":66}}},   # שייטל
  55: {"default":"mr",  "levels":{"rare":{"c":52},"mr":{"c":57},"med":{"c":60},"mw":{"c":63},"well":{"c":66}}},   # שפיץ צ'אך
  # ground / fast (no rare for safety)
  17: {"default":"med", "levels":{"mr":{"c":60},"med":{"c":65},"mw":{"c":68},"well":{"c":71}}},                    # קבב
  18: {"default":"med", "levels":{"mr":{"c":55},"med":{"c":57},"mw":{"c":63},"well":{"c":71}}},                    # המבורגר
  # ── lamb steak cuts ──
  35: {"default":"mr",  "levels":{"rare":{"c":52},"mr":{"c":56},"med":{"c":60},"mw":{"c":64},"well":{"c":68}}},   # ירך טלה — Leg
  36: {"default":"med", "levels":{"rare":{"c":52},"mr":{"c":55},"med":{"c":60},"mw":{"c":63},"well":{"c":66}}},   # קארה — Rack (fatty → med default)
  60: {"default":"med", "levels":{"rare":{"c":52},"mr":{"c":55},"med":{"c":60},"mw":{"c":63},"well":{"c":66}}},   # מותן טלה — Loin
  # ── poultry white meat (juicy / recommended / firm) ──
  41: {"default":"med", "scale":"white", "levels":{"mr":{"c":60},"med":{"c":62},"well":{"c":65}}},    # חזה עוף
  19: {"default":"med", "scale":"white", "levels":{"mr":{"c":60},"med":{"c":62},"well":{"c":65}}},    # חזה הודו
  # ── poultry dark meat (tender / recommended / shreddable) ──
  5:  {"default":"med", "scale":"dark", "levels":{"mr":{"c":65},"med":{"c":68},"well":{"c":74}}},     # פרגיות
  38: {"default":"med", "scale":"dark", "levels":{"mr":{"c":65},"med":{"c":68},"well":{"c":72}}},     # עוף שלם ספאצ'קוק
  39: {"default":"med", "scale":"dark", "levels":{"mr":{"c":65},"med":{"c":68},"well":{"c":74}}},     # כנפיים
  40: {"default":"med", "scale":"dark", "levels":{"mr":{"c":65},"med":{"c":72},"well":{"c":80}}},     # שוקיים
  67: {"default":"med", "scale":"dark", "levels":{"mr":{"c":65},"med":{"c":72},"well":{"c":80}}},     # כרעיים
  42: {"default":"med", "scale":"dark", "levels":{"mr":{"c":68},"med":{"c":74},"well":{"c":82}}},     # שוק הודו
  68: {"default":"med", "scale":"dark", "levels":{"mr":{"c":68},"med":{"c":74},"well":{"c":80}}},     # כנפי הודו
  # ── duck/goose breast (like red meat) ──
  9:  {"default":"mr",  "levels":{"rare":{"c":54},"mr":{"c":57},"med":{"c":62},"mw":{"c":65}}},                    # חזה אווז
  48: {"default":"mr",  "levels":{"rare":{"c":54},"mr":{"c":57},"med":{"c":62},"mw":{"c":65}}},                    # חזה ברווז
  # ── pork steak cuts (MR from 57°, USDA-safe 63°) ──
  29: {"default":"med", "levels":{"mr":{"c":57},"med":{"c":60},"mw":{"c":61},"well":{"c":63}}},                    # פילה חזיר — Loin
  30: {"default":"med", "levels":{"mr":{"c":57},"med":{"c":60},"mw":{"c":61},"well":{"c":63}}},                    # פילה חזיר מדומה — Tenderloin
  33: {"default":"med", "levels":{"mr":{"c":57},"med":{"c":60},"mw":{"c":61},"well":{"c":63}}},                    # קוטלט חזיר — Chop
  # ── fish (silky / recommended / firm) — capped ≤54° ──
  49: {"default":"med", "scale":"fish", "levels":{"mr":{"c":46},"med":{"c":50},"well":{"c":54}}},     # סלמון
  50: {"default":"med", "scale":"fish", "levels":{"mr":{"c":46},"med":{"c":52},"well":{"c":54}}},     # פורל
  # ── offal that cooks like a steak ──
  69: {"default":"mr",  "levels":{"rare":{"c":52},"mr":{"c":55},"med":{"c":62},"mw":{"c":65}}},                    # לב בקר — heart, hot & fast
  70: {"default":"med", "scale":"dark", "levels":{"med":{"c":68},"well":{"c":74}}},                  # לבבות עוף — poultry, safe ≥68
}
for _c in CUTS:
    if _c["n"] in DONENESS:
        _c["doneness"] = DONENESS[_c["n"]]
