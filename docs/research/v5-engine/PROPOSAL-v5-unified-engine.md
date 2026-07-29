# מערכת הפיטמאסטר החכם — מסמך אפיון ארכיטקטורה שלם (הצעה חיצונית)

> **מקור:** מסמך אפיון שהביא הבעלים (2026-07-29) לניתוח והשוואה מול הארכיטקטורה הקיימת.
> **סקופ הדיון (הוראת הבעלים):** רק **מנוע החוקים v5.0** וההסברים הרלוונטיים אליו + שאלת התשתית
> (Cloudflare Worker / Supabase). שאר הנושאים (מפת דרכים ל-React, אסטרטגיית UI) — **מחוץ לדיון**.
> **זהו מסמך הצעה חיצוני — לא תיעוד של המערכת הקיימת שלנו.**

גרסת מנוע החוקים: v5.0 (Unified Engine) — שדרוג ואיחוד מלא של גרסאות v2.0, v3.0 ו-v4.0.
תצורת יעד מוצעת: PWA (Offline-First) → Cloudflare Workers → Supabase (PostgreSQL + JSONB) → React.

---

## 1. מהות המוצר וערך ייחודי

מערכת הפעלה לוגיסטית וקולינרית חכמה לפיטמאסטרים, מבוססת מדע המזון וחוקי התרמודינמיקה.

### 1.1 העיקרון המרכזי — הפרדת משתנים

הפרדה חדה בין שתי שכבות:

- **עמוד השדרה הפיזיקלי (Hard Physics):** ניהול חום, לחות, זמן ומקום. המשתנים שקובעים מרקם,
  עסיסיות, רמת פירוק שומן ובטיחות.
- **שכבת הטעם הקולינרית (Flavor Layer):** ראבים, מרינדות, רטבים וזיגוגים — "תוספים" (Plugins)
  שאינם משנים את המבנה המולקולרי אלא רק את פרופיל הטעם.

**התובנה המרכזית:** לא כדאי לאסוף מאות מתכונים עצמאיים. אם תאסוף 100 מתכונים לעישון בריסקט, 95 מהם
הם קומבינציות שונות של אותם משתנים בדיוק. במקום לשכפל מתכונים — לבנות **"מתכון-על" (Master Recipe)**
מבוסס משתנים: מתכון אחד חכם שמייצר עשרות תוצאות על ידי שינוי פרמטרים.

### 1.2 ערך מוסף ייחודי (The Moat)

- **אופטימיזציה מרחבית וזמנית מבוזרת:** ניהול צי מכשירים מגוון וגזירה לאחור של לו"ז משולב, כדי
  שנתחים שונים יגיעו למוכנות שיא באותה דקה.
- **ניהול משברים בזמן אמת (IoT Telemetry):** האזנה ללוגים של מדחומים, זיהוי "סטאל" או נפילת חומרה,
  וחישוב מסלול מחדש (העברה לתנור ביתי / שימוש בצידנית מבודדת כבאפר זמן).
- **ניהול מלאי מתכלים:** גזירת רשימת קניות מדויקת (ק"ג פחם/פלט, מטרים של נייר קצבים) מותאמת לסוג
  המעשנה ואורך האירוע.

### 1.3 מקור הנתונים — שתי שכבות

- **שכבת המידע המוסמך (Data Layer):** טמפרטורות יעד לפסטור ובטיחות מ-USDA/FDA; פירוק קולגן ונקודות
  התכה של שומנים ממדע המזון הקלאסי (McGee — On Food and Cooking, AmazingRibs). ערכים **קבועים
  (Hardcoded)** בבסיס הנתונים.
- **שכבת חוכמת המנוע (Logic Layer):** הלוגיקה שמחברת בין המשתנים — מה קורה כשמשלבים עישון וסו-וויד,
  מתי בדיוק למרוח זיגוג. זהו האלגוריתם המקורי.

---

## 2. הבסיס הקולינרי — ניתוח שיטות בישול והפרדת משתנים

### 2.1 האם שווה לשמור יותר מדרך אחת לעישון אותו נתח?

כשמורידים משתני טעם חיצוניים, נשאר ניהול חום/לחות/זמן. **התשובה: כן** — שינוי בטכניקת העישון משנה
מרקם, עסיסיות, פירוק שומן ועוצמת טעם עשן.

**התהליכים המשנים את התוצאה בתוך עולם העישון:**

- **טמפרטורת העישון:**
  - עישון איטי (95°C-110°C): נתחים קשים עתירי קולגן; חלון ארוך לפירוק ג'לטין; טבעת עשן עמוקה.
  - עישון מהיר (135°C-150°C): מקצר בחצי, קראסט פריך מהר, מונע ייבוש.
- **שלב העטיפה (The Stall):**
  - ללא עטיפה: קראסט קשיח כהה, טעם עשן דומיננטי.
  - נייר קצבים: נושם — שומר לחות ומאיץ בישול בלי להרוס קראסט.
  - נייר אלומיניום (Texas Crutch): אטום — אפקט אידוי; רך ומתפרק, קראסט רך ורטוב.
- **ניהול לחות:** הזרקה (Injection) לעסיסיות פנימית; ריסוס חיצוני (Spritzing) למשיכת חלקיקי עשן.
- **כיוון הנתח:** שומן למעלה (הגנה מהתייבשות) מול שומן למטה (הגנה ממקור חום תחתון).

### 2.2 השוני הדרמטי — מעבר בין שיטות בישול

- **קדירה (Braising):** צריבה ואז בישול איטי בנוזל. סביבה רטובה 100% — אין קראסט, ריכוך מוחלט.
- **סו-וויד:** ואקום, טמפ' מדויקת נמוכה (58°C) ל-24-48 שעות. 0% אידוי — רכות + שמירת צבע ורדרד.
- **צלייה יבשה (Roasting):** חום בינוני-גבוה ללא נוזלים וללא עשן; מייאר מהיר, טעם נטורלי.
- **בישול בלחץ:** מעל 100°C; פירוק בשעה במקום 10.

### 2.3 "פונקציה" מול "פרמטרים"

| פונקציה | תיאור |
|---|---|
| `Function_Smoke` | עישון (חום יבש + עשן) |
| `Function_Braise` | קדירה (חום רטוב) |
| `Function_SousVide` | ואקום (חום מולקולרי מדויק) |
| `Function_Roast` | תנור יבש |

פרמטרים המשפיעים על מרקם: `Target_Internal_Temp`, `Chamber_Temp`, `Wrap_Stage`, `Moisture_Control`.
פרמטרים המשפיעים על טעם: `Wood_Profile`, `Surface_Treatment`, `Deep_Flavor`.

**דוגמה:** "אסאדו במרקם מפורק, קראסט פריך, טעם מתקתק" → `Wrap_Stage=Paper`,
`Target_Internal_Temp=102°C`, `Wood_Profile=Cherry`, `Surface_Treatment=Glaze`.

---

## 3. המתכון-על (Master Recipe) — מודל הפרמטרים

### 3.1 טבלת הפרמטרים המלאה

| מזהה | שם | ערכים אפשריים | השפעה |
|---|---|---|---|
| `P_COOK_METHOD` | שיטת בישול | SMOKE, SOUS_VIDE, OVEN_BRAISE, GRILL | קובע את עץ ההחלטות והשלבים |
| `P_CHAMBER_TEMP` | חום סביבה | 55°C–250°C | קצב העברת חום ופיתוח מעטפת |
| `P_TARGET_INT` | טמפ' יעד פנימית | 54°C (מדיום) \| 95°C (נימוח) \| 103°C (מפורק) | המרקם הסופי |
| `P_TIME_LIMIT` | מגבלת זמן | דקות/שעות/ימים | כשבישול ארוך משנה מרקם ללא שינוי טמפ' |
| `P_MOIST_ENV` | סביבת לחות | DRY \| WET \| VACUUM | האם ייווצר קראסט או אידוי/שליקה |
| `P_SURFACE` | טיפול שטח | DRY_RUB \| MARINADE \| NONE | פרופיל טעם חיצוני והשפעה על קראסט |
| `P_FINISH` | פעולת סיום | GRILL_HIGH \| OVEN_BROIL \| FLAMBE \| NONE | תגובת מייאר בסוף |

### 3.2 עץ החלטות ולוגיקה (פסאודו-קוד)

המתכון: עישון ראשוני לטעם → סו-וויד לרכות → פיניש בגריל לקראסט.

```
INPUT CUT = "Asado_Ribs"
INPUT PREFERENCE_TEXTURE = "Super_Tender_Juicy"
INPUT PREFERENCE_FLAVOR = "Smoky_And_Crusty"

IF PREFERENCE_TEXTURE == "Super_Tender_Juicy" AND PREFERENCE_FLAVOR == "Smoky_And_Crusty":
    SET PROCESS_FLOW = ["STAGE_1_SMOKE", "STAGE_2_SOUS_VIDE", "STAGE_3_GRILL_FINISH"]

// --- STAGE 1: SMOKE ---
CONF_STAGE_1:
    P_CHAMBER_TEMP = 105°C
    P_MOIST_ENV = "DRY"
    P_WOOD_TYPE = "OAK_HICKORY"
    P_SURFACE = "SALT_PEPPER"
    TRIGGER_NEXT_STAGE_WHEN = (TIME_ELAPSED == 2_HOURS) OR (P_TARGET_INT == 50°C)

// --- STAGE 2: SOUS VIDE ---
CONF_STAGE_2:
    PREPARE = "Cool_Down_Meat_Then_Vacuum_Pack"
    P_CHAMBER_TEMP = 68°C
    P_MOIST_ENV = "VACUUM"
    TRIGGER_NEXT_STAGE_WHEN = (TIME_ELAPSED == 24_HOURS)

// --- STAGE 3: GRILL FINISH ---
CONF_STAGE_3:
    PREPARE = "Remove_From_Bag_And_Dry_Surface"
    P_SURFACE_GLAZE = "OPTIONAL_BBQ_SAUCE"
    P_CHAMBER_TEMP = 230°C
    P_MOIST_ENV = "DRY"
    TRIGGER_COOK_COMPLETE_WHEN = (SURFACE_COLOR == "DEEP_BROWN") AND (TIME_ELAPSED == 10_MINUTES)
```

**החוק המרכזי:** `IF SOUS_VIDE IS USED, AND CRUST IS DESIRED -> ADD FINISH_STAGE (GRILL/OVEN)`.

### 3.3 טבלת הנתחים המלאה

עוף: לחות גבוהה בהתחלה, סיום בחום >165°C לעור פריך. דגים: זמנים קצרים, יעד נמוך (סלמון ~51°C).
ירקות/פירות: קרמליזציה; עישון קצר מאוד למניעת מרירות. שרקוטרי: חימום + עשן + פריכות בלבד.

| חומר גלם | שיטה | טמפ' סביבה | טמפ' יעד | זמן | הערה למנוע |
|---|---|---|---|---|---|
| בריסקט | SMOKE + OVEN_BRAISE (עטוף) | 110°C | 96-98°C | 8-14 ש' | חובה לעטוף ב-71°C (The Stall) |
| אנטריקוט | SOUS_VIDE + GRILL_FINISH | 56°C → 250°C | 54°C | 2 ש' + 2 דק' | בישול ארוך מדי → עיסתי |
| חזה עוף | SOUS_VIDE + GRILL_FINISH | 63°C → 220°C | 63°C | 1.5 ש' | מתייבש ב-74°C |
| פילה סלמון | SMOKE | 80°C | 50-52°C | 45-60 דק' | פולט אלבומין אם החום גבוה |
| נקניקיות | SMOKE + GRILL | 105°C → 200°C | 74°C | 45+5 דק' | ספיגת עשן ופיצוץ מעטפת |
| אננס | GRILL | 200°C | לפי צבע | 10-15 דק' | קרמליזציה של פרוקטוז |
| כתף חזיר | SMOKE + OVEN_BRAISE | 110°C | 96-102°C | 10-14 ש' | פירוק קולגן מוחלט |
| חזה ברווז | SOUS_VIDE + PAN_SEAR | 57°C → 220°C | 57°C | 1.5 ש' + 4 דק' | חריצת עור לצמצום שומן |
| כבד | GRILL | 220°C | 63-65°C | 4-8 דק' | בישול יתר → גרגירי ומתכתי |
| לשון בקר | OVEN_BRAISE / לחץ | 130°C | 93°C | 4 ש' / שעה | בישול ארוך בנוזל |
| גבינות קשות | COLD_SMOKE | מתחת ל-30°C | לא רלוונטי | 1-3 ש' | חריגה → הזעה והתכה |
| חלומי | GRILL | 220°C | לא רלוונטי | 4-6 דק' | נקודת התכה גבוהה |

---

## 4. מנוע החוקים הקולינרי האוניברסלי v5.0

איחוד v2.0 (Pipeline מונחה עצמים + מעשנות/דלק/ציוד), v3.0 (אופטימיזציה ותזמון), v4.0 (צי, טלמטריה,
צידנית, משברים) למנוע אחד: **בדיקות חסימה → התאמת ציוד ודלק → בניית Pipeline → אופטימיזציה → תגובה
בזמן אמת.**

### 4.1 החוקים הקשיחים (Hard Rules)

**חוק 1 — הגנת לעיסתיות:**
```
IF CUT_TYPE == "High_Collagen" AND P_COOK_METHOD == "GRILL" WITHOUT "SOUS_VIDE"/"BRAISE"
    -> RETURN ERROR: "Meat will be too tough. Requires long braising or smoking."
```

**חוק 2 — בטיחות עוף (פסטור):** פסטור = פונקציה של טמפרטורה × זמן; חום נמוך מחייב הארכת זמן.
```
IF PROTEIN == "Poultry" AND P_TARGET_INT < 74°C:
    IF P_COOK_METHOD != "SOUS_VIDE" -> RETURN ERROR.
```

**חוק 3 — מניעת שריפת סוכרים:**
```
IF P_SURFACE_TREATMENT == "High_Sugar_Glaze" AND P_CHAMBER_TEMP > 140°C AND TIME_REMAINING > 30_MINUTES
    -> TRIGGER WARNING: "Sugar will burn. Delay glaze to the last 15 minutes."
```

**חוק 4 — סכנת פירוק דגים:**
```
IF PROTEIN == "Fish" AND P_TARGET_INT > 60°C
    -> SET P_TARGET_INT = 52°C AND NOTIFY_USER("Adjusted to prevent fish from drying out").
```

**חוק 5 — הגנת התכת גבינות:**
```
IF CATEGORY == "Cheese" AND P_COOK_METHOD == "SMOKE":
    IF P_CHAMBER_TEMP > 30°C:
        RETURN ERROR: "Chamber temperature too high. Use COLD SMOKE rules (<30°C)."
```

**חוק 6 — צמצום שומן עופות מים:**
```
IF PROTEIN_TYPE IN ["Duck", "Goose"] WITH_SKIN == TRUE:
    FORCE_ACTION = "Score_Skin_Pattern"
    IF "GRILL_FINISH" NOT IN PROCESS_FLOW AND "PAN_SEAR" NOT IN PROCESS_FLOW:
        ADD_STAGE_TO_END("PAN_SEAR_HIGH_HEAT", Target = "Skin_Side_Down")
```

**חוק 7 — בטיחות בשר חזיר:**
```
IF PROTEIN_TYPE == "Pork" AND P_TARGET_INT < 63°C:
    IF P_COOK_METHOD != "SOUS_VIDE":
        SET P_TARGET_INT = 63°C
        NOTIFY_USER("Target temperature raised to 63°C for pork safety regulations.")
```

### 4.2 מנגנון זיגוג ורוטב

זיגוג מופעל רק ב-15-30 הדקות האחרונות ורק תחת חום יבש. רוטב = רכיב פוסט-בישול או נוזל מגש בשלב העטיפה.

```
FUNCTION Apply_Sauce_And_Glaze_Rules(P_COOK_METHOD, P_CHAMBER_TEMP, TIME_REMAINING):
    IF SOURCE_INGREDIENT == "Sugar_Based_Glaze":
        IF P_CHAMBER_TEMP > 140°C AND TIME_REMAINING > 20_MINUTES:
            GENERATE_ACTION("DELAY_GLAZE", Trigger_At = "20_MINUTES_BEFORE_END")
    IF P_COOK_METHOD == "SOUS_VIDE" AND SOURCE_INGREDIENT == "Liquid_Sauce":
        REMOVE_INGREDIENT_FROM_BAG()
        GENERATE_ACTION("REDUCE_SAUCE_SEPARATELY")
```

### 4.3 מנגנון ציוד ובדיקת חסמים

```
INPUT USER_EQUIPMENT = ["OVEN", "GRILL"]

FUNCTION Validate_Equipment_For_Cut(CUT, USER_EQUIPMENT):
    IF CUT == "Brisket":
        REQUIRED_ALTERNATIVES = ["SMOKE", "SOUS_VIDE", "OVEN_BRAISE"]
        AVAILABLE_METHODS = INTERSECT(REQUIRED_ALTERNATIVES, USER_EQUIPMENT)
        IF AVAILABLE_METHODS.LENGTH == 0:
            RETURN ERROR: "לא ניתן לבשל נתח זה..."
        ELSE:
            RETURN AVAILABLE_METHODS
```

**מאפייני מעשנות ומקדם עוצמת עשן:**

| סוג מעשנה | דלק/עץ | מקדם עשן |
|---|---|---|
| אופסט | גזעי עץ מלאים | 1.5 |
| קאבינט אנכית פחם | פחם קברצ'ו + צ'אנקים | 1.2 |
| פלט | כופתי עץ 100% | 0.8 |
| חשמל/גז | שבבי עץ בקופסה | 0.6 |

ציוד עזר: נייר קצבים, אלומיניום, כפפות חום, מבער ידני, צינור עישון קר, ואקום סילר, מדחום.

### 4.4 מנגנון המרת שיטות בישול (Time/Method Conversion)

```
FUNCTION Convert_Recipe(Source_Method, Target_Method, Base_Time):
    IF Source_Method == "SMOKE_LOW_SLOW" AND Target_Method == "PRESSURE_COOKER":
        SET NEW_CHAMBER_TEMP = 120°C
        SET NEW_MOIST_ENV = "WET_LIQUID"
        SET TIME_CONVERSION_FACTOR = 0.12   // קיצור ~88%
        SET LOSS_OF_ATTR = ["BARK", "SMOKE_AROMA"]

    IF Source_Method == "SMOKE_LOW_SLOW" AND Target_Method == "SOUS_VIDE":
        SET NEW_CHAMBER_TEMP = 68°C
        SET NEW_MOIST_ENV = "VACUUM"
        SET TIME_CONVERSION_FACTOR = 2.5    // הארכה פי 2.5
        SET LOSS_OF_ATTR = ["BARK"]
        SET GAIN_OF_ATTR = ["HIGHER_JUICINESS"]
```

**דוגמה:** אסאדו 110°C ל-10 שעות → סיר לחץ: שעה ו-12 דקות. התראה: "המרקם יהיה רך, אך תאבד קראסט וטעם עשן".

### 4.5 הקוד המלא (TypeScript) — UniversalCulinaryEngine v5.0

```typescript
interface UserEquipment {
    core_cookers: Array<"OFFSET_SMOKER" | "VERTICAL_CABINET_SMOKER" | "PELLET_SMOKER" | "ELECTRIC_SMOKER" | "GAS_SMOKER" | "SOUS_VIDE" | "OVEN" | "GRILL">;
    control_tools: Array<"MEAT_THERMOMETER_WIRELESS" | "MEAT_THERMOMETER_INSTANT_READ" | "VACUUM_SEALER">;
    accessories: Array<"BUTCHER_PAPER" | "FOIL" | "HEAT_GLOVES" | "BLOW_TORCH" | "SMOKE_TUBE">;
    vessel_capacity_liters?: number;
}

interface MeatInput {
    id: string;
    category: "Beef" | "Poultry" | "Fish" | "Pork" | "Cheese" | "Internal_Organs";
    collagen_level: "HIGH" | "LOW";
    has_skin: boolean;
    weight_kg: number;
}

interface FlavorProfile {
    id: string;
    rub_type: "DRY" | "NONE";
    has_sugar: boolean;
    sauce_or_glaze: "WET_SAUCE" | "SUGAR_GLAZE" | "NONE";
}

class UniversalCulinaryEngine {
    public generateRecipePipeline(meat: MeatInput, equipment: UserEquipment, flavor: FlavorProfile): any {
        let pipeline: any[] = [];
        let systemWarnings: string[] = [];

        // --- שלב א': בדיקות חסימה קריטיות ---
        if (meat.collagen_level === "HIGH" && !equipment.core_cookers.some(c => ["OFFSET_SMOKER", "VERTICAL_CABINET_SMOKER", "PELLET_SMOKER", "SOUS_VIDE", "OVEN"].includes(c))) {
            throw new Error("חסימת מערכת: נתח עשיר בקולגן דורש בישול ארוך. אין ציוד מתאים.");
        }

        const hasSmoker = equipment.core_cookers.some(c => ["OFFSET_SMOKER", "VERTICAL_CABINET_SMOKER", "PELLET_SMOKER", "ELECTRIC_SMOKER", "GAS_SMOKER"].includes(c));
        const hasThermometer = equipment.control_tools.includes("MEAT_THERMOMETER_WIRELESS") || equipment.control_tools.includes("MEAT_THERMOMETER_INSTANT_READ");
        if (hasSmoker && !hasThermometer) {
            throw new Error("חסימת מערכת: עישון מחייב מדחום בשר. סכנה בטיחותית.");
        }

        if (meat.category === "Cheese" && hasSmoker && !equipment.accessories.includes("SMOKE_TUBE")) {
            systemWarnings.push("אזהרה: עישון גבינה ללא צינור עישון קר יגרום להתכה.");
        }

        // --- שלב ב': דלק ועץ ---
        let fuelRecommendation = "";
        let smokeIntensityAdjustment = 1.0;
        if (equipment.core_cookers.includes("OFFSET_SMOKER")) {
            fuelRecommendation = "גזעי עץ מלאים (אלון/היקורי לבקר, תפוח/דובדבן לעוף/חזיר).";
            smokeIntensityAdjustment = 1.5;
        } else if (equipment.core_cookers.includes("VERTICAL_CABINET_SMOKER")) {
            fuelRecommendation = "פחם קברצ'ו כבסיס + צ'אנקים לארומה.";
            smokeIntensityAdjustment = 1.2;
        } else if (equipment.core_cookers.includes("PELLET_SMOKER")) {
            fuelRecommendation = "כופתי עץ 100% עץ קשה. פרופיל עשן מעודן.";
            smokeIntensityAdjustment = 0.8;
        } else if (equipment.core_cookers.includes("ELECTRIC_SMOKER") || equipment.core_cookers.includes("GAS_SMOKER")) {
            fuelRecommendation = "שבבי עץ רטובים קלות בקופסת עישון.";
            smokeIntensityAdjustment = 0.6;
        }

        // --- שלב ג': בניית Pipeline ---
        let prepStep: any = { stage: "PREPARATION", instructions: [] };
        if (meat.category === "Poultry" || meat.has_skin) {
            prepStep.instructions.push("חריצת העור וייבוש במקרר 4 שעות לפריכות.");
        }
        if (flavor.rub_type === "DRY") {
            prepStep.instructions.push("מריחת ראב יבש אחיד; אבקת חרדל כ-Binder.");
        }
        pipeline.push(prepStep);

        if (equipment.core_cookers.includes("SOUS_VIDE") && meat.collagen_level === "HIGH") {
            if (meat.weight_kg * 3 > (equipment.vessel_capacity_liters || 0)) {
                throw new Error("חסימת מערכת: נפח המים הנדרש גדול מקיבולת האמבט.");
            }
            pipeline.push({
                stage: "MAIN_COOK_SOUS_VIDE",
                chamber_temp: "68°C", target_internal: "68°C", duration: "24_HOURS",
                required_accessories: equipment.control_tools.includes("VACUUM_SEALER") ? [] : ["ZIP_TOP_BAG_WATER_DISPLACEMENT"]
            });
        } else if (hasSmoker) {
            let chamberTemp = meat.category === "Poultry" ? "135°C" : "110°C";
            pipeline.push({
                stage: "MAIN_COOK_SMOKE",
                chamber_temp: chamberTemp,
                target_internal: meat.category === "Beef" ? "71°C" : "74°C",
                fuel_and_wood: fuelRecommendation,
                required_accessories: ["HEAT_GLOVES"]
            });

            if (meat.collagen_level === "HIGH") {
                let wrapMaterial = "NONE";
                if (equipment.accessories.includes("BUTCHER_PAPER")) wrapMaterial = "BUTCHER_PAPER";
                else if (equipment.accessories.includes("FOIL")) wrapMaterial = "FOIL";
                pipeline.push({
                    stage: "THE_STALL_WRAP",
                    instruction: `בהגעה ל-71°C יש לעטוף ב-${wrapMaterial}.`,
                    chamber_temp: chamberTemp, target_internal: "95°C",
                    required_accessories: ["HEAT_GLOVES", wrapMaterial]
                });
            }
        }

        if (flavor.sauce_or_glaze === "SUGAR_GLAZE") {
            if (equipment.core_cookers.includes("GRILL") || equipment.core_cookers.includes("OVEN")) {
                pipeline.push({ stage: "FINISH_GLAZE", chamber_temp: "200°C", duration: "15_MINUTES",
                    instruction: "מריחת הזיגוג ב-15 הדקות האחרונות בלבד.", required_accessories: ["HEAT_GLOVES"] });
            } else if (equipment.accessories.includes("BLOW_TORCH")) {
                pipeline.push({ stage: "FINISH_GLAZE_TORCH", instruction: "קרמליזציה במבער ידני.",
                    required_accessories: ["BLOW_TORCH", "HEAT_GLOVES"] });
            } else {
                systemWarnings.push("אין גריל/תנור/מבער לקרמליזציה. הזיגוג יוגש קר.");
            }
        }

        return { success: true, pipeline, warnings: systemWarnings, smoke_intensity_multiplier: smokeIntensityAdjustment };
    }
}
```

---

## 5. מנוע האופטימיזציה הלוגיסטית

ניהול אירוע מרובה-נתחים מבוסס אילוצי מקום (מדפים/תלייה) וגזירת זמנים לאחור (Backward Scheduling).

### 5.1 הרחבת הישויות

**קיבולת מעשנה:** `number_of_shelves`, `shelf_dimensions_cm` (שטח בסמ"ר), `hanging_capable`.
**ישות אירוע:** `event_id`, `target_serve_time`, `meals_schedule_json`, `guest_count`.

### 5.2 The Event Dispatcher v3.0

```typescript
interface EventContext { target_serve_time: Date; guest_count: number; allow_resting_time: boolean; }
interface DetailedEquipment {
    type: "OFFSET_SMOKER" | "VERTICAL_CABINET_SMOKER" | "PELLET_SMOKER" | "GRILL";
    shelves_count: number; shelf_area_cm2: number; supports_hanging: boolean;
    preferred_charcoal?: "QUEBRACHO" | "BRIQUETTES" | "CITRUS_WOOD";
    preferred_wood_aroma?: "OAK" | "HICKORY" | "APPLE" | "CHERRY";
}
interface MenuItems {
    meat_id: string; name: string; weight_kg: number;
    required_cook_time_mins: number; required_resting_mins: number;
    placement_preference: "SHELF" | "HANGING"; area_required_cm2: number;
}

class EventOptimizationEngine {
    public optimizeEvent(menu: MenuItems[], equipment: DetailedEquipment, event: EventContext): any {
        let scheduleTimeline: any[] = [];
        let spatialAllocation: { [key: number]: number } = {};
        let hangingUsed = 0;
        let systemLogs: string[] = [];

        for (let i = 1; i <= equipment.shelves_count; i++) spatialAllocation[i] = 0;

        // --- אופטימיזציה מרחבית ---
        for (let item of menu) {
            let allocated = false;
            if (item.placement_preference === "HANGING" && equipment.supports_hanging) {
                hangingUsed++; allocated = true;
            } else {
                for (let i = 1; i <= equipment.shelves_count; i++) {
                    if (equipment.shelf_area_cm2 - spatialAllocation[i] >= item.area_required_cm2) {
                        spatialAllocation[i] += item.area_required_cm2; allocated = true; break;
                    }
                }
            }
            if (!allocated) throw new Error(`חסימת נפח: אין מקום עבור [${item.name}].`);
        }

        // --- גזירת זמנים לאחור ---
        let globalServeTime = new Date(event.target_serve_time);
        for (let item of menu) {
            let cookEndTime = new Date(globalServeTime.getTime() - (item.required_resting_mins * 60000));
            let cookStartTime = new Date(cookEndTime.getTime() - (item.required_cook_time_mins * 60000));
            scheduleTimeline.push({
                meat_name: item.name,
                action_start_entry: cookStartTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                action_wrap_stall: new Date(cookStartTime.getTime() + (item.required_cook_time_mins * 0.6 * 60000)).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                action_end_cook: cookEndTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                resting_duration_mins: item.required_resting_mins,
                ready_to_serve: globalServeTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
            });
        }
        scheduleTimeline.sort((a, b) => a.action_start_entry.localeCompare(b.action_start_entry));
        return { success: true, timeline: scheduleTimeline, space_allocation_logs: systemLogs };
    }
}
```

**דוגמת פלט** (אסאדו + עוף שלם ל-20:00): אסאדו נכנס ב-11:00 (8 ש' בישול + שעה מנוחה), עוף ב-17:45
(2 ש' + 15 דק'), אסאדו על מדף 1 (40% תפוסה), עוף בתלייה.

### 5.3-5.5 צי, צידנית ומשברים (v4.0)

- **Fleet Management:** מערך מכשירים; ביזור עומסים למכשיר משני בחריגת מקום/טמפרטורה.
- **צידנית מבודדת (Faux Cambro):** שומרת מעל 60°C ל-4-8 שעות; משמשת כ-Buffer לשחרור מקום ולחץ מהלו"ז.
- **Disaster Recovery:** נפילת טמפרטורה/סטאל ארוך → סימולציה מחדש והצעת גיבוי (תנור ביתי).

```typescript
class RealTimeCulinaryEngine {
    // א. שיבוץ מבוזר על צי
    public allocateFleetAndSpace(menu: FleetMenu[], fleet: CookingDevice[]): FleetMenu[] { /* ... */ }

    // ב. טלמטריה ו-ETA חזוי
    public processTelemetry(menuItem, sensor, targetServeTime, hasCoolerBox): any {
        // סטאל: 68-74°C ו-est_time_remaining > 120 → CRISIS_SPEED_UP (עטיפה + העלאת חום ב-15°C)
        // הגעה ליעד + זמן עד הגשה > מנוחה + יש צידנית → TRANSFER_TO_COOLER
    }

    // ד. ניהול תקלות חומרה
    public handleDeviceFailure(failedDeviceId, fleet, menu): any {
        // גיבוי 1: תנור פנוי → העברה (הבשר כבר ספג עשן)
        // גיבוי 2: גריל עם מכסה
        // אחרת: status = FAILED
    }
}
```

---

## 6. מנוע ה-IoT וניהול מתכלים

### 6.1 שלוש אסטרטגיות לקריאת מדחום ב-PWA

מדחומים חכמים (Meater, Inkbird, ThermoWorks) הם אקו-סיסטם סגור:
- **א. Webhooks / Cloud Integration:** Edge Function פונה לענן היצרן כל דקה ומזרים ל-JSONB.
- **ב. קריאת קובץ לוג (File System Access API):** המשתמש מייצא CSV/JSON ומעלה בלחיצה.
- **ג. גיבוי ידני (Manual Override):** אין נתונים 5 דקות → כפתור צף "עדכן טמפרטורה ידנית".

### 6.2-6.3 Edge Function לקליטת IoT

`POST /iot-telemetry` → שליפת `live_timeline` מ-Supabase → עדכון הנתח → הרצת חוקי זמן-אמת
(הגעה ליעד → `RESTING_HOLDING` + `TRANSFER_TO_COOLER`; זיהוי Stall 69-73°C → הוראת `WRAP`) →
שמירת JSONB → `trigger_push_notification`.

### 6.4 מחשבון מתכלים

| סוג מעשנה | קצב צריכה |
|---|---|
| אופסט | ~1.5 ק"ג גזעי עץ/שעה |
| קאבינט פחם | ~0.8 ק"ג פחם/שעה + 2 גושי עץ/שעה |
| פלט | ~1.0 ק"ג/שעה (נמוך) או 2.0 (גבוה) |
| נייר קצבים | ~1.5 מטר לנתח עטוף |

חישוב עם 20% מרווח ביטחון (`safetyBuffer = 1.2`).

---

## 7. מנוע הטעמים (Flavor Profile Engine)

תיבול = "שכבת תוסף" שאינה משנה חוקי פיזיקה, אך חייבת להתאים לחלבון הבסיס. 4 אלמנטים: מלח, מתוק,
חריף/תבלינים, חומציות.

| פרופיל | רכיבים | חוק התאמה |
|---|---|---|
| טקסס | 50% פלפל שחור, 50% מלח גס, שום | RECOMMEND: Beef_High_Fat. BLOCK: Fish |
| אסייתי | סויה, סוכר דקלים/דבש, ג'ינג'ר, 5 תבלינים, חומץ אורז | RECOMMEND: Pork, Duck, Chicken, Salmon |
| ים תיכוני | מלח ים, שום, רוזמרין, טימין, אורגנו, שמן זית | RECOMMEND: Lamb, Chicken, Organs, Vegetables |

**חוקי שילוב:**
- `SOUS_VIDE`: אין שמן/חמאה בשקית; הורדת כמות התבלינים ב-30% (הטעם מרוכז בוואקום).
- `SMOKE`: ראב יבש בלבד בתחילה, ללא סוכר מעל 120°C (לאפשר קשירת עשן למיוגלובין → Smoke Ring).

---

## 8. לוגיקת UI (4 שלבים)

בחירת חומר גלם → פרופיל טעם (רק מתאימים) → מסלול תהליכי ("מהיר" / "פריך מסורתי" / "נימוח עסיסי")
→ Dashboard הוראות הפעלה.

---

## 9. הארכיטקטורה הכוללת

### 9.1 SQL מול NoSQL ופתרון Supabase

**למה SQL למנוע חוקים:** קשרים לוגיים קשיחים (Relational Integrity). Foreign Keys מונעים פרופיל
ציוד עם מכשיר שלא קיים → מונע קריסות Runtime. עדכון גלובלי (טמפ' בטיחות עוף 74°C→73°C) = שורה אחת.

**איפה NoSQL מנצח:** ה-Pipeline הסופי שנוצר — דינמי לחלוטין (3 שלבים למשתמש אחד, 5 לאחר).

**הפתרון: Supabase (היברידי)** — PostgreSQL + JSONB + Realtime + Auth + Edge Functions.

### 9.2 ארכיטקטורה

- **Cloudflare:** PWA Front-End (Offline-First/LocalStorage) + **Cloudflare Worker = מנוע החוקים v5.0**
- **Supabase:** PostgreSQL + JSONB (`events.live_timeline`), Realtime + Auth, Edge Function ל-IoT
- **Gemini API:** ניתוח מתכון טקסטואלי → פרמטרים

### 9.3 סכמה

```sql
CREATE TABLE user_fleet (
    device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    shelves_count INT DEFAULT 1,
    shelf_area_cm2 FLOAT NOT NULL,
    supports_hanging BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_name VARCHAR(150) NOT NULL,
    target_serve_time TIMESTAMPTZ NOT NULL,
    guest_count INT NOT NULL,
    has_cooler_box BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'PLANNING',
    live_timeline JSONB NOT NULL
);
```

`live_timeline` מכיל `meta` + `items[]` עם `current_internal_temp`, `status`, `next_action`.

### 9.5 עלות

| שירות | תפקיד | מחיר בפיתוח |
|---|---|---|
| Cloudflare Workers | מנוע החוקים v5.0 Serverless | חינם עד 100K בקשות/יום |
| Supabase | PostgreSQL + JSONB + Realtime + Auth | חינם עד 500MB |
| Gemini API | מתכון טקסטואלי → פרמטרים | חינם במגבלת קצב |

---

## 10-12. (מחוץ לסקופ הדיון לפי הוראת הבעלים)

מפת דרכים ל-React, סימולציות מקצה-לקצה, וסיכום מנהלים — נשמרו במסמך המקור אך אינם חלק מהדיון הנוכחי.

**תמצית הסימולציות (להקשר בלבד):**
- **ברווז אסייתי:** מנוע מפצל תיבול — מלח בשקית הסו-וויד, זיגוג מתוק רק ל-2 דקות אחרונות בגריל.
- **גבינת צ'דר עם תנור/גריל בלבד:** חוק 5 חוסם — נדרש עישון קר <30°C, הציוד לא מתאים.
- **כבד עוף → סו-וויד:** המרה 5 דק' → 45 דק' ב-65°C; התראה על היעדר קראסט.
