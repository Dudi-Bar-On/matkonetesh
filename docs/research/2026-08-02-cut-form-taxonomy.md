# מחקר · ייצוג הצורה (FORM) של נתח בקטלוג — התקדים של Meater ומודלים חלופיים

**תאריך:** 2026-08-02 · **סוג:** מחקר בלבד. לא שונה קוד, לא שונה `data.py`, לא שונה `sources.py`.
**השאלה:** איך מייצגים את ההבדל בין *אותו נתח בצורת חיתוך אחרת* (entrecôte מול entrecôte steak,
פילה בקר מול מדליוני פילה) לבין *חלק אנטומי אחר של אותה חיה* (חזה עוף מול רבעים מול כנפיים).

---

## 0. שער §10.11 — הגרף הגלובלי נבדק ראשון, ואין בו כלום

הרצתי מול `~/.graphify/global-graph.json` (9 קורפוסים, 4,674 nodes) את אוצר המילים הרלוונטי:
`meater`, `primal`, `subprimal`, `butcher`, `NAMP`, `doneness`, `thermometer` — **כולם `No matching nodes found`**.
`IMPS` ו-`meat cut` החזירו התאמות **שווא** בלבד (substring לתוך `Simpson's Paradox Awareness` ולתוך
קורפוס ה-`methodology` של GSD) — לא תוכן על בשר.

> **מסקנה מפורשת:** הגרף הגלובלי **ריק בנושא הזה**. כל מה שלהלן הגיע ממחקר רשת, כנדרש ב-§10.11.
> לא הומצאו טוקנים כדי לכפות פגיעה.

---

## 1. המודל של Meater — מה הוא באמת

### 1.1 שלוש הקטגוריות שהבעלים זכר — **מאושרות**

תחת **Beef** (וכן תחת Pork ותחת Lamb) אפליקציית Meater מחלקת ל-**שלוש** תת-קטגוריות:

| תת-קטגוריה | Beef | Pork | Lamb |
|---|---|---|---|
| **Steak** | Sirloin, Rib Eye, Flank, T-Bone, Tomahawk, Filet Mignon, Picanha, New York Strip, Other | Chop, Loin, Tenderloin, Shoulder, Secreto, Other | Chop, Neck Filet, Cutlet, Other |
| **Roast** | Roasting Joint, Tenderloin, Brisket, Prime Rib, Round, Tri-Tip, Shank, Rump, Chuck, Sirloin, Other | Butt, Shoulder, Leg, Ham, Loin, Virginia Ham, Belly, Other | Loin, Brisket, Leg, Rump, Shank, Rib Rack, Other |
| **Other** | Ground, Burger, Rib, Meatloaf, Liver, Shin, Tongue, Other | Ground, Tongue, Jowl, Cheek, Liver, Rib, Other | Ground, Burger, Rib, Other |

**מקור:** `Cooking with the MEATER App`, MEATER Support (Apption Labs) —
<https://support.meater.com/hc/en-us/articles/36774867052827-Cooking-with-the-MEATER-App>

**הסתייגות מתודולוגית שחייבת להיאמר.** `WebFetch` ישיר לדף החזיר **HTTP 403** (Zendesk חוסם בוטים).
הרשימה לעיל שוחזרה מאינדקס-החיפוש של אותו URL בדיוק, ב-**שלוש** שאילתות עצמאיות שהחזירו את אותה
היררכיה מילה-במילה. זו ראיה חזקה אך **לא צילום מסך ולא קריאה ישירה** — היא מסומנת כאן כ-**מאושר ברמת
מקור-משני-של-הדף-הרשמי**, לא כ-verbatim שנקרא בעיניי.

**סתירה שנמצאה, ומדווחת.** ביקורת FoodFireFriends (מהדורת אפליקציה מוקדמת) מתארת רשימת בקר **שטוחה**
בלי Steak/Roast/Other: *"rib-eye, brisket, prime rib, chuck, sirloin, T-bone, tenderloin, round, shank,
and ground"* (<https://www.foodfirefriends.com/meater-review/>). **ההסקה שלי** (לא קביעת מקור): החלוקה
לשלוש היא **תוספת מאוחרת** לאפליקציה. הזיכרון של הבעלים מדויק לגרסה הנוכחית.

### 1.2 קטגוריות-העל — חמש, לא ארבע

`Beef · Pork · Poultry · Lamb · Fish` (FoodFireFriends, וכן דף התמיכה). **אין** קטגוריית-על בשם
"red meat"; מה שהבעלים תיאר כ"מתחת לבשר אדום" הוא בפועל **התבנית החוזרת** תחת כל אחד משלושת המינים
האדומים — Beef, Pork, Lamb — וזה **מחזק** את הטענה שלו, לא מחליש אותה.

### 1.3 Poultry שובר את הציר — וזו הנקודה החשובה ביותר במסמך

| Poultry | האפשרויות |
|---|---|
| Chicken | Whole, Breast, Thigh, Leg, Ground, Burger |
| Duck | Whole, Breast |
| Goose | Whole, Breast, Thigh, Leg |
| Turkey | Whole, Breast, Thigh, Leg, Ground, Burger |

תחת עוף **אין** Steak/Roast/Other. הרובד השני הוא **מין** (Chicken/Duck/Goose/Turkey) והרובד השלישי
הוא **חלק אנטומי** (Breast/Thigh/Leg) או **שלמות** (Whole/Ground).

> **זו התשובה לשאלה 2:** Meater **כן** מפריד בין צורת-חיתוך לבין חלק-אנטומי — אבל **לא בציר אחד**.
> בבשר אדום הרובד השני הוא **צורה**; בעוף הרובד השני הוא **מין** והחלק האנטומי יורד לרובד השלישי.
> זהו מודל **היברידי ולא-אחיד** — הוא לא מפריד את שני הצירים, הוא **בוחר ציר אחר לכל ענף**.

### 1.4 ההוכחה שהציר של הבשר האדום הוא באמת FORM ולא אנטומיה

ארבע ראיות מתוך הרשימות עצמן:

1. **`Sirloin` מופיע גם תחת Steak וגם תחת Roast** (Beef). אותו סאב-primal, שתי צורות, שתי רשומות.
2. **`Filet Mignon` תחת Steak · `Tenderloin` תחת Roast** (Beef) — אותו שריר (psoas major), שני שמות,
   שתי צורות. **זה בדיוק המקרה של הבעלים** (פילה בקר מול מדליוני פילה).
3. **`Loin` תחת Steak וגם תחת Roast** (Pork).
4. **`Shank` תחת Roast (Beef) ו-`Shin` תחת Other (Beef)** — אותו איבר, ניתוב שונה לפי שימוש.

מנגד, `Brisket` מופיע תחת Roast **גם ב-Beef וגם ב-Lamb** — כלומר הענף הוא לפי-מין, והצורה היא הרובד
שמתחתיו.

### 1.5 מה נושא את התנהגות הבישול אצלם — **לא הטקסונומיה**

**זו ההפתעה המרכזית של המחקר.** אצל Meater:

- **טמפרטורת יעד** נגזרת מהטקסונומיה: אחרי בחירת הנתח מוצגות דרגות עשייה עם ערכים
  (Rare 125°F · Medium Rare 135°F · Medium 145°F · Medium Well 155°F · Well Done 165°F), לצד
  `MEATER Recommends` ולצד ערכי USDA; *"the app will never recommend a temperature that isn't safe
  for consumption"*. מקור: <https://meater.com/learn/steak-internal-temperature-guide>.
- **זמן בישול לא נגזר מהטקסונומיה בכלל.** ה-`Advanced Estimator Algorithm` מחשב אותו **חיה, מסנסורים**:
  הוא מופיע רק אחרי שהטמפרטורה הפנימית עלתה ‎8°C/16°F מנקודת ההתחלה, משתמש בחיישן ה-Ambient
  (שמופיע רק כשהוא ‎5°C/10°F מעל הפנימית), ומתקן ל-carryover. מקורות:
  <https://support.meater.com/hc/en-us/articles/36914985836315-Cook-Time-Estimate-in-the-MEATER-App> ·
  <https://support.meater.com/hc/en-us/articles/37182246162331-Ambient-Temperature-Sensor>.
  הם אף מתעדים במפורש שהאלגוריתם **לא** יודע להתמודד עם ה-stall בבריסקט/כתף — *"doesn't account for
  this delay, as it can vary greatly from one cut of meat to the next"*.

> **התשובה לשאלה 3:** אצל Meater הטקסונומיה נושאת **טמפרטורה בלבד**. את הזמן נושאת **פיזיקה חיה**.
> **לכן הם יכולים להרשות לעצמם טקסונומיה גסה של שלוש קטגוריות** — הם לא צריכים שהיא תסביר את הזמן.
> **אנחנו כן צריכים.** ל-`מתכונת` אין חיישן. `svh`/`smh`/`soh` בקטלוג הם הערכים שנקבעים מראש.
> **זה הבדל מבני, לא הבדל טעם — והוא פוסל העתקה ישירה של המודל שלהם.**

**דרגת העשייה נבחרת בנפרד מהנתח**, אך **הטווח מותנה בנתח**: Ground/Burger מקבלים 160°F לפי USDA ולא
מוצעת להם דרגת Rare; יש אזהרה ייעודית ליעד מעל 195°F/90°C
(<https://support.meater.com/hc/en-us/articles/36523451273627-Why-am-I-getting-a-warning-for-target-temperatures-over-195-F-90-C>).

**הערה נוספת:** *"The meat cuts you see in the app are based on your phone's region"*
(<https://meater.com/app-features>) — הטקסונומיה שלהם **תלוית-לוקאל**. רלוונטי מאוד לנו: `אנטריקוט`,
`סינטה`, `ואסיו`, `אונטרייב` הם מונחים ישראליים שאין להם מקבילה 1:1 באף רשימה אמריקאית.

---

## 2. מודל השוואה A — IMPS / NAMP (התקן התעשייתי, והתשובה הקפדנית ביותר)

`Institutional Meat Purchase Specifications`, USDA AMS; ממוספר בצולב מול `NAMP` (North American Meat
Processors). מקור: <https://www.ams.usda.gov/grades-standards/imps> ·
Series 100 Fresh Beef: <https://www.ams.usda.gov/sites/default/files/media/IMPS_100_Fresh_Beef[1].pdf>

**ההיררכיה:** carcass → sides → quarters → **primals** → **subprimals** → **portion / retail cuts**.
המסמך מזהה אותם *"using the anatomical skeletal structure and physiological characteristics"* — כלומר
הרובד העליון הוא **אנטומיה טהורה**.

**איך FORM נכנס — וזו התובנה המרכזית:** לצורת המנה יש **מרחב מספרים נפרד** — ה-**1000-series**.
פריט ה-portion cut מקבל את מספר האב שלו עם קידומת `1`:

| Subprimal (האב) | Portion cut (הצורה) |
|---|---|
| `112` Ribeye Roll | `1112` Ribeye Roll Steak |
| `112A` Ribeye Roll, Lip-On | `1112A` Ribeye Steak, Lip-On |
| — | `1112C` Ribeye Steak, Boneless |
| — | `1112D` Ribeye Cap Steak |

מקורות: <https://www.chefs-resources.com/types-of-meat/beef/cuts-of-beef/rib-steak-ribeye-steak-names/> ·
NAMP *Beef Cuts for Foodservice* (עותק PDF ציבורי, מציג `1112D Beef Rib, Ribeye Cap Steak (IM)`):
<https://www.virtualweberbullet.com/wp-content/uploads/2018/08/beef-cuts-for-foodservice-2015.pdf>

> **הפרדה נקייה של שני הצירים:** זהות אנטומית = שלוש הספרות האחרונות (`112`), נשמרת ללא שינוי;
> צורה = הקידומת `1`. גם וריאנטים (`A`, `C`, `D`) נשמרים דרך הצורה. **זה בדיוק המודל שהבעלים מחפש.**
> IMPS גם **לא** קובע עובי/משקל בעצמו — *"purchasers shall specify the portion weight and/or thickness
> desired"* — כלומר **הצורה היא מחלקה, והמידה היא פרמטר של המופע**.
> ⚠️ **סימון כנות:** כלל הקידומת `1` אושר משני מקורות משניים אמינים (chefs-resources + ה-PDF של NAMP)
> ומשני חיפושים; ה-PDF הרשמי של AMS **לא נקרא ישירות** (`ENOTFOUND` ואז `403`). דרגת ביטחון: **גבוהה,
> לא ודאית**. אם ההחלטה תישען על הכלל הזה — כדאי לאמת מול ה-PDF הרשמי לפני מימוש.

---

## 3. מודל השוואה B — USDA FSIS: הבטיחות מתעלמת מהצורה, לגמרי

<https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart>
(‏403 ל-WebFetch; התוכן דרך אינדקס החיפוש של אותו דף ושל
<https://ask.fsis.usda.gov/article/What-is-a-safe-internal-temperature-for-cooking-meat-and-poultry>)

| קטגוריה | מינימום בטוח |
|---|---|
| Beef, Pork, Lamb, Veal — **steaks, chops, and roasts** | 145°F (63°C) + 3 דק' מנוחה |
| Ground meats | 160°F (71°C) |
| **All** poultry | 165°F (74°C) |

> **"steaks, chops **and roasts**" — שלוש צורות, מספר אחד.** זו ראיה ישירה, ממקור ראשוני, לכך שהטענה
> של הבעלים נכונה: **`safe` הוא אינוריאנטי לצורת החיתוך.** הצירים ש-*כן* מזיזים את `safe` הם
> **שלמות** (שריר שלם מול טחון — כי הטחינה מפזרת חיידקי-שטח פנימה) ו-**מין** (עוף).
> **בדיקה מול הקטלוג שלנו:** ב-`data.py` כל נתחי הבקר השלמים נושאים `safe=63` — בריסקט (`n=1`),
> פיקאניה (`n=6`), טומאהוק (`n=11`), אנטריקוט רוסט (`n=23`), פילה בקר (`n=27`) — בעוד קבב (`n=17`)
> והמבורגר (`n=18`) נושאים `safe=71`. **הקטלוג שלנו כבר מקודד בדיוק את הציר של FSIS.**

---

## 4. מודל השוואה C — Baldwin / ChefSteps-Anova: זמן = עובי, טמפ' = עשייה

<https://www.chefsteps.com/activities/sous-vide-time-and-temperature-guide> ·
<https://anovaculinary.com/pages/sous-vide-time-and-temperature-guide>

הכלל: *"Sous vide cooking times are altered by thickness, not by weight. Temperature determines the
level of doneness, but time ensures the food is cooked all the way through."*

> זהו מודל ש**מוותר על טקסונומיית נתחים לגמרי** לצורך המספרים: הוא מפרק לשני משתנים פיזיקליים —
> **עובי → זמן**, **טמפרטורה → עשייה**. זהות הנתח נשארת רק כדי לקבוע קולגן/רקמת-חיבור.
> זה ה-backbone שכבר אימצנו (`docs/sources/baldwin-backbone.md`).

**מודל השוואה D (רקע, בקצרה):** ההיררכיה הקלאסית של הקצבות —
`Meat Cutting and Processing for Food Service` (BCcampus, CC-BY,
<https://opentextbc.ca/meatcutting/chapter/primal-sub-primal-and-secondary-cuts/>;
מראה: <https://workforce.libretexts.org/Bookshelves/Food_Production_Service_and_Culinary_Arts/Meat_Cutting_and_Processing_for_Food_Service_(BC_Campus)/03:_Cutting_and_Processing_Meats/3.02:_Primal_Sub-primal_and_Secondary_Cuts>).
היא מגדירה primal/sub-primal לפי אנטומיה, ואת ה-portion cuts (roasts, steaks) כתוצר **פברוק** מהם —
זהה במבנה ל-IMPS אך בלי מספור.

---

## 5. ההמלצה — מנומקת, לא מוצהרת

**המלצה: לאמץ את מודל IMPS (ציר `cut_identity` × ציר `form`) ולדחות את מודל Meater.**

### 5.1 למה לא Meater

1. **הטקסונומיה שלהם לא נושאת זמן** (§1.5) — כי חיישן נושא אותו במקומה. **אין לנו חיישן.**
   אימוץ `Steak/Roast/Other` אצלנו יקנה לנו קיבוץ ויזואלי ולא ייתן שום מספר.
2. **הציר שלהם לא אחיד** — בשר אדום לפי צורה, עוף לפי מין (§1.3). הקטלוג שלנו כולל בקר, טלה, חזיר,
   עוף, הודו, אווז ונקניקיות; מודל לא-אחיד יתפוצץ בדיוק בענפים שכבר יש לנו.
3. **`Other` הוא סל אשפה** — `Ground, Burger, Rib, Meatloaf, Liver, Shin, Tongue` באותה מגירה.
   אצלנו `לשון בקר` (`n=22`) ו-`לחי בקר` (`n=10`) הם פריטים מלאים עם ציטוט; קטגוריית-שארית תסתיר אותם.
4. **`Steak` ו-`Roast` הם שמות של גודל, לא של צורה.** הם לא יודעים לתאר `מדליונים`, `קוביות שיפוד`,
   `פרפר`, `ספירלה` — צורות שקיימות אצלנו בפועל (`קבב`, `שווארמה`).

### 5.2 מה כן — הצורה כמאפיין, לא ככותרת

הקטלוג הנוכחי הוא רשימה **שטוחה** של `dict(n, cat, heb, eng, kg, safe, tgt, svh, smh, soh, …)`.
ההמלצה **אינה** לשבור אותה, אלא להוסיף **שני שדות ולא לגעת בשום ערך קיים**:

- `base` — מזהה הנתח האנטומי (מקביל ל-`112` ב-IMPS). דוגמה: `beef-ribeye`.
- `form` — הצורה: `whole` (ברירת מחדל) · `roast` · `steak` · `medallion` · `cube` · `ground` · `strip`.

`base` **הוא נושא הציטוט**. `form` **הוא נושא הזמן**. `safe` נשאר על ה-`base` ולא זז לעולם.

> **ההצדקה מהמקורות, ולא מהעדפה שלי:** FSIS נותן מספר אחד ל-steaks+chops+roasts (§3) — לכן `safe`
> תלוי ב-`base` בלבד. IMPS נותן מספר-פריט נפרד לכל צורה (§2) — לכן `form` חייב מפתח משלו.
> Baldwin/ChefSteps אומרים שזמן נגזר מעובי (§4) — לכן `form` (ולא `base`) הוא שיקבע את `svh`/`smh`/`soh`.

### 5.3 העלויות — במפורש, כולל עלות הציטוטים

| חזית | עלות |
|---|---|
| **ציטוטים (`sources.py`, 279 ציטוטים)** | **≈ אפס.** `safe` נשאר צמוד ל-`base`, וכל פריט קיים מקבל `form` נגזר משמו הנוכחי (`אנטריקוט רוסט` → `base=beef-ribeye, form=roast`). **אף מפתח `n` לא משתנה, אף `safe` לא זז — ולכן שום ציטוט לא מתייתם.** זו הסיבה העיקרית להעדיף את המודל הזה. |
| **הזנת נתונים** | הצורה החדשה עולה כסף. כל `form` חדש דורש `svh`/`smh`/`soh`/`kg` משלו — ואלה **לא** נגזרים אוטומטית מהאב. גידול לינארי במספר הצורות. |
| **ניווט ב-UI** | חייב פתרון: 3 צורות × 40 נתחים = רשימה שאי אפשר לגלול. ההצעה: הקטלוג ממשיך להציג `base`, והצורה נבחרת **בכרטיס** (כמו שדרגת-עשייה נבחרת אצל Meater — §1.5). זה גם מונע ניפוח של `data.py`. |
| **דו-לשוניות** | `form` דורש 23 תרגומים × 7 ערכים = 161 מחרוזות. לא זניח, אבל אלה מונחים קצרים וסגורים. |
| **הסיכון האמיתי** | פיתוי לגזור זמן משקלול `kg` אוטומטי. **אסור** — הזמנים הקיימים מצוטטים. `form` חדש = ערך מוזן ידנית ומצוטט, בדיוק כמו היום. |

### 5.4 החלופה שנדחתה, ולמה

**"פשוט להוסיף פריטים שטוחים חדשים"** (כמו שכבר נעשה: `אנטריקוט רוסט` `n=23` לצד `סינטה רוסט` `n=26`).
זול היום, יקר מחר: אין דרך לדעת ש-`פילה בקר` ו-`מדליוני פילה` חולקים `safe` ומקור, ולכן **תיקון בטיחותי
עתידי יצטרך להימצא ידנית בכל המופעים** — בדיוק סוג התקלה שהמרשם נוצר כדי למנוע.

**Trade-off מרכזי אחד, בשורה:** נשלם עלות הזנת-נתונים לינארית לכל צורה חדשה — בתמורה לכך ש-`safe`
והציטוט נשארים במקום אחד ולא מתייתמים לעולם.

---

## 6. פערים ו-UNDETERMINED

| # | פער | סטטוס |
|---|---|---|
| U-1 | קריאה ישירה verbatim של דף התמיכה של Meater | **לא הושגה** — 403. אושר דרך אינדקס חיפוש ×3. |
| U-2 | ה-PDF הרשמי של IMPS 100 | **לא נקרא** — `ENOTFOUND` ואז 403. כלל ה-1000-series אושר משני מקורות משניים. |
| U-3 | האם Meater גוזר **דרגות עשייה זמינות** מהתת-קטגוריה או מהנתח הבודד | **UNDETERMINED.** ידוע רק ש-Ground מוגבל ל-160°F. |
| U-4 | האם ל-Meater יש מודל `base`/`form` פנימי או רק קיבוץ תצוגתי | **UNDETERMINED.** `Sirloin` בשתי מגירות מרמז על שכפול, לא על הפניה — אך זו הסקה, לא ממצא. |
| U-5 | טקסונומיה ישראלית רשמית (משרד החקלאות / מועצת הבקר) | **לא נבדק** בסבב הזה. מומלץ לפני קיבוע שמות `base`. |
