# השלמות מלאות למסמך ההצעה — הסעיפים שקוצרו בשמירה הראשונה

> נכתב 2026-07-29 אחרי הערת הבעלים שהניתוח הראשון לא קרא את המסמך לעומק.
> קובץ זה משחזר **מילה במילה** את הסעיפים שקיצרתי ב-`PROPOSAL-v5-unified-engine.md`.
> יש לקרוא את שני הקבצים כמסמך אחד.

---

## §5.3 ניהול צי מכשירים (Fleet Management) — v4.0

המערכת מקבלת מערך של מספר מכשירי בישול (`equipment_fleet`). המנוע משבץ נתחים במכשיר הראשי, ובמקרה
של חריגת מקום/טמפרטורה מבצע **"ביזור עומסים" (Load Balancing)** למכשיר משני — למשל העברת נתח קטן
לגריל פחם עם קופסת עישון.

## §5.4 צידנית מבודדת (Faux Cambro Buffer)

צידנית מבודדת איכותית שומרת נתח בשר חם בטמפרטורה בטוחה **מעל 60°C למשך 4-8 שעות**. המנוע משתמש בה
כאזור חיץ (Buffer): אם נתח מוכן מוקדם מדי, המערכת מורה להעביר אותו לצידנית — **משחררת מקום במעשנה
ומורידה לחץ מהלו"ז**.

## §5.5 ניהול משברים ותקלות (Disaster Recovery) — הקוד המלא

במקרה של נפילת טמפרטורה (האש כבתה / נגמר הפלט) או נתח שנתקע ב"סטאל" ארוך מהצפוי, המערכת מריצה
סימולציה מחדש ומציעה פתרונות גיבוי.

```typescript
// === 1. הגדרת ממשקי הקלט והחומרה המתקדמים ===

interface CookingDevice {
    id: string;
    type: "OFFSET_SMOKER" | "PELLET_SMOKER" | "VERTICAL_CABINET" | "OVEN" | "GRILL_WITH_LID";
    shelves_count: number;
    shelf_area_cm2: number;
    current_status: "IDLE" | "COOKING" | "FAULT";
    current_chamber_temp?: number; // נתון שמגיע מה-IoT בזמן אמת
}

interface RealTimeSensorData {
    meat_id: string;
    current_internal_temp: number;
    timestamp: Date;
}

interface FleetMenu {
    meat_id: string;
    name: string;
    weight_kg: number;
    target_internal: number;
    est_time_remaining_mins: number;
    required_resting_mins: number;
    area_required_cm2: number;
    status: "PENDING" | "COOKING" | "RESTING_HOLDING" | "SERVED" | "FAILED";
    assigned_device_id?: string;
}

// === 2. מנוע הבקרה והאופטימיזציה בזמן אמת ===

class RealTimeCulinaryEngine {

    // א. שיבוץ מבוזר על פני צי מכשירים מרובה (Fleet Allocation)
    public allocateFleetAndSpace(menu: FleetMenu[], fleet: CookingDevice[]): FleetMenu[] {
        let activeFleet = fleet.filter(d => d.current_status !== "FAULT");

        for (let item of menu) {
            let allocated = false;

            // ניסיון שיבוץ במכשירים הייעודיים (מעשנות)
            for (let device of activeFleet.filter(d => d.type.includes("SMOKER") || d.type === "VERTICAL_CABINET")) {
                if (device.shelf_area_cm2 >= item.area_required_cm2) {
                    device.shelf_area_cm2 -= item.area_required_cm2; // תפיסת מקום
                    item.assigned_device_id = device.id;
                    allocated = true;
                    break;
                }
            }

            // גיבוי: שימוש בגריל עם מכסה לעישון קטן אם המעשנות מלאות
            if (!allocated) {
                let backupGrill = activeFleet.find(d => d.type === "GRILL_WITH_LID" && d.shelf_area_cm2 >= item.area_required_cm2);
                if (backupGrill) {
                    backupGrill.shelf_area_cm2 -= item.area_required_cm2;
                    item.assigned_device_id = backupGrill.id;
                    allocated = true;
                    // המערכת מזריקה הוראה להשתמש בצינור עישון/קופסת שבבים בגריל
                }
            }

            if (!allocated) {
                item.status = "FAILED"; // אין מקום פיזי בשום מכשיר בצי
            }
        }
        return menu;
    }

    // ב. עדכון זמנים דינמי מבוסס סנסורים (Telemetry Update & Predictive ETA)
    public processTelemetry(menuItem: FleetMenu, sensor: RealTimeSensorData, targetServeTime: Date, hasCoolerBox: boolean): any {
        let alertMessage = "";
        let actionRequired = "CONTINUE";

        // חישוב קצב עליית החום (הערכת המערכת לעומת המציאות)
        // אם הנתח הגיע ל-71 מעלות והוא תקוע שם כבר שעה (The Stall)
        if (sensor.current_internal_temp >= 68 && sensor.current_internal_temp <= 74 && menuItem.est_time_remaining_mins > 120) {
            // הנתח בסטאל קשה – המערכת מחשבת שהזמן עלול להתארך מעבר ללו"ז
            let predictedReadyTime = new Date(Date.now() + (menuItem.est_time_remaining_mins * 60000) + (menuItem.required_resting_mins * 60000));

            if (predictedReadyTime > targetServeTime) {
                actionRequired = "CRISIS_SPEED_UP";
                alertMessage = `הנתח [${menuItem.name}] נתקע בשלב הסטאל. כדי לעמוד בזמן ההגשה, המערכת ממליצה לעטוף מיד בנייר קצבים/אלומיניום ולהעלות את חום התא ב-15°C.`;
            }
        }

        // ג. אופטימיזציה באמצעות צידנית מבודדת (Cooler Box / Holding Buffer)
        if (sensor.current_internal_temp >= menuItem.target_internal && menuItem.status === "COOKING") {
            menuItem.status = "RESTING_HOLDING";

            let timeUntilServing = (targetServeTime.getTime() - Date.now()) / 60000;

            if (timeUntilServing > menuItem.required_resting_mins && hasCoolerBox) {
                actionRequired = "TRANSFER_TO_COOLER";
                alertMessage = `הנתח [${menuItem.name}] מוכן מוקדם מהצפוי! העבר אותו מיד לצידנית מבודדת (עטוף במגבת). הוא יישמר שם עסיסי וחם עד להגשה ב-${targetServeTime.toLocaleTimeString()}. זה משחרר מקום במעשנה.`;
            } else {
                actionRequired = "STANDARD_REST";
                alertMessage = `הנתח [${menuItem.name}] מוכן. העבר אותו למנוחה סטנדרטית בטמפרטורת החדר.`;
            }
        }

        return { menuItem, actionRequired, alertMessage };
    }

    // ד. מנוע ניהול משברים ותקלות חומרה (Disaster Recovery Engine)
    public handleDeviceFailure(failedDeviceId: string, fleet: CookingDevice[], menu: FleetMenu[]): any {
        let failedDevice = fleet.find(d => d.id === failedDeviceId);
        if (failedDevice) failedDevice.current_status = "FAULT";

        let affectedItems = menu.filter(item => item.assigned_device_id === failedDeviceId && item.status === "COOKING");
        let resolutionLogs: string[] = [];

        for (let item of affectedItems) {
            // תוכנית גיבוי 1: האם יש תנור פנוי? (תנור הוא פתרון הגיבוי המושלם לבשר שכבר קיבל עשן)
            let backupOven = fleet.find(d => d.type === "OVEN" && d.current_status === "IDLE");

            if (backupOven) {
                item.assigned_device_id = backupOven.id;
                resolutionLogs.push(`תקלה במכשיר ${failedDeviceId}! נתח [${item.name}] הועבר לתנור הביתי להמשך בישול. הבשר כבר ספג עשן, התוצאה לא תיפגע משמעותית.`);
            }
            // תוכנית גיבוי 2: האם יש גריל פנוי?
            else {
                let backupGrill = fleet.find(d => d.type === "GRILL_WITH_LID" && d.current_status === "IDLE");
                if (backupGrill) {
                    item.assigned_device_id = backupGrill.id;
                    resolutionLogs.push(`תקלה! נתח [${item.name}] הועבר לגריל עם מכסה (חום עקיף).`);
                }
                // מוצא אחרון בהחלט: דחיית זמן או ביטול
                else {
                    item.status = "FAILED";
                    resolutionLogs.push(`קריטי: אין מכשיר חלופי זמין עבור [${item.name}]. לא ניתן לספק מרכיב זה לארוחה!`);
                }
            }
        }

        return { menu, resolutionLogs };
    }
}
```

### סימולציית ניהול משבר בזמן אמת

**הסיטואציה:** אירוע ללו"ז 20:00, מעשנת פלט עיקרית + תנור ביתי לגיבוי, נתח אסאדו.
**המשבר:** בשעה 16:00 מעשנת הפלט חווה קצר חשמלי ומפסיקה לעבוד.

```json
{
  "device_status_update": "PELLET_SMOKER_01 -> STATUS_FAULT",
  "affected_items": ["Asado_Ribs"],
  "resolution_logs": [
    "תקלה במכשיר PELLET_SMOKER_01! נתח [Asado_Ribs] הועבר לתנור הביתי להמשך בישול בחום של 115°C.",
    "ניתוח קולינרי: הבשר כבר התבשל 5 שעות וספג את מקסימום ארומת העשן הנדרשת. מעבר לתנור בשלב זה ישמור על הלו'ז המקורי ב-100% ללא פגיעה במרקם או בטעם."
  ],
  "push_notification_to_user": "⚠️ תקלה במעשנה! העבר את האסאדו לתנור הביתי שחומם מראש ל-115°C. הלו'ז לא נפגע."
}
```

---

## §6.4 מנגנון ניהול חומרי גלם מתכלים — הקוד המלא

```typescript
interface ConsumablesInventory {
    wood_pellets_kg: number;
    charcoal_kg: number;
    wood_chunks_count: number;
    butcher_paper_meters: number;
    aluminum_foil_meters: number;
}

function calculateRequiredConsumables(totalCookTimeHours: number, deviceType: string, menuItems: any[]): ConsumablesInventory {
    let inventory: ConsumablesInventory = {
        wood_pellets_kg: 0, charcoal_kg: 0, wood_chunks_count: 0,
        butcher_paper_meters: 0, aluminum_foil_meters: 0
    };

    // 1. חישוב דלק ואנרגיה לפי סוג המכשיר ואורך האירוע (כולל 20% מרווח ביטחון)
    const safetyBuffer = 1.2;
    const adjustedHours = totalCookTimeHours * safetyBuffer;

    if (deviceType === "PELLET_SMOKER") {
        inventory.wood_pellets_kg = Math.ceil(adjustedHours * 1.0);
    } else if (deviceType === "VERTICAL_CABINET_SMOKER") {
        inventory.charcoal_kg = Math.ceil(adjustedHours * 0.8);
        inventory.wood_chunks_count = Math.ceil(totalCookTimeHours * 2);
    } else if (deviceType === "OFFSET_SMOKER") {
        inventory.charcoal_kg = Math.ceil(adjustedHours * 0.5);  // פחם רק להדלקה ראשונית
        inventory.wood_chunks_count = Math.ceil(adjustedHours * 3);
    }

    // 2. חישוב אביזרי עטיפה לפי כמות הנתחים הדורשים עטיפה במתכון
    for (let item of menuItems) {
        if (item.collagen_level === "HIGH") {
            inventory.butcher_paper_meters += 1.5;
            inventory.aluminum_foil_meters += 1.5;
        }
    }
    return inventory;
}
```

**דוגמת פלט** (אסאדו + עוף, 9 שעות, מעשנת פחם) — כולל **נימוק לכל פריט**:

```json
{
  "shopping_list_recommendation": {
    "event_duration_hours": 9,
    "device_type": "VERTICAL_CABINET_SMOKER",
    "items_to_buy": [
      { "item": "פחם איכותי (מומלץ קברצ'ו)", "quantity": "9 קילו",
        "reason": "מבוסס על צריכה של 0.8 קילו לשעה לאורך 9 שעות בישול + 20% גיבוי למקרה של רוחות או קור חיצוני." },
      { "item": "גושי עץ לעישון (Chunks) - אלון/פקאן", "quantity": "18 גושים",
        "reason": "הוספת 2 גושים לפחם בכל שעה ב-4 השעות הראשונות של העישון לצורך החדרת ארומה עמוקה." },
      { "item": "נייר קצבים (Butcher Paper)", "quantity": "2 מטרים",
        "reason": "עבור שלב העטיפה (The Stall) של נתח האסאדו." }
    ]
  }
}
```

---

## §8 מבנה ממשק המשתמש ולוגיקת הזרימה — **המנגנון המרכזי שקוצר**

כדי שהאפליקציה תהיה קלה להבנה, המשתמש אינו צריך לראות את כל הקוד. הוא עובר חוויה בת **4 שלבים**:

```
[שלב 1: בחירת חומר הגלם]
המשתמש בוחר קטגוריה (בקר / עוף / דגים / גבינה) -> ואז נתח ספציפי (למשל: אסאדו).
        |
        V
[שלב 2: הגדרת פרופיל טעם (תוספים)]
המערכת מציגה לו רק פרופילים שמתאימים לנתח (טקסס, אסייתי, ים תיכוני). המשתמש בוחר.
        |
        V
[שלב 3: בחירת מסלול תהליכי (החלטה)]
המערכת מזהה את הציוד שהוגדר מראש בפרופיל המשתמש, ומציגה לו אפשרויות למרקמים:
- "אני רוצה תוצאה מהירה" (המערכת תבחר סיר לחץ/תנור)
- "אני רוצה תוצאה פריכה ומסורתית" (המערכת תבחר מעשנה)
- "אני רוצה תוצאה נימוחה ועסיסית במיוחד" (המערכת תבחר סו-וויד + גריל)
        |
        V
[שלב 4: פלט הוראות הפעלה (The Dashboard)]
המערכת מציגה מסך שלבים ברור עם טמפרטורות, זמנים, והתראות מתי להוסיף את הזיגוג או מתי לעטוף.
```

---

## §11 סימולציות מקצה לקצה — שלושתן במלואן

### תרחיש א': ברווז אסייתי עם ציוד מלא (סו-וויד + גריל)

**קלט:** נתח `Duck_Breast` (עם עור). פרופיל טעם: אסייתי (`Sweet_Umami`).

**ריצה במנוע:** המנוע בודק ציוד ומזהה שיש סו-וויד וגריל, ובוחר במסלול המשולב האופטימלי לברווז. הוא
מזהה פרופיל אסייתי (מכיל סוכר/דבש) ומפעיל את חוק הזיגוג — **מפצל את התיבול**: מלח בלבד לשקית
הסו-וויד, ואת הזיגוג המתוק שומר רק ל-2 הדקות האחרונות על הגריל.

**פלט:**
- הנחיית הכנה: חרוץ את עור הברווז שתי וערב, המלח קלות.
- שלב 1 (סו-וויד): בשל ב-57°C למשך 1.5 שעות (בשקית ואקום ללא נוזלים).
- שלב 2 (גריל/מחבת): יבש את הנתח. צרוב על חום גבוה מאוד (220°C) כשהעור כלפי מטה במשך 3 דקות
  לצמצום השומן. בדקה האחרונה, מרח את הזיגוג האסייתי והפוך למשך 60 שניות.

### תרחיש ב': משתמש עם ציוד מוגבל (גבינת צ'דר לעישון) — פעולה חסומה

**קלט:** `Cheddar_Cheese`. פרופיל: מעושן קלאסי. ציוד: `USER_EQUIPMENT = ["OVEN", "GRILL"]`.

**ריצה:** המנוע מזהה גבינה ומפעיל את חוק 5. בודק את הציוד הזמין: בתנור ובגריל רגיל הטמפרטורה
המינימלית היא לרוב מעל 50°C. **המנוע מזהה שאין התאמה בין דרישת הטמפרטורה של חומר הגלם לציוד הזמין.**

**פלט:**
- שגיאת מערכת: "לא ניתן לבצע את המתכון."
- **סיבה:** גבינת צ'דר דורשת עישון קר בטמפרטורה של פחות מ-30°C כדי שלא תנמס. התנור והגריל שברשותך
  מייצרים חום גבוה מדי.
- **פתרון מוצע:** כדי לבצע זאת, עליך להצטייד באביזר לעישון קר (כמו ספירלת עשן קרה) לגריל כבוי.

### תרחיש ג': המרת שיטת בישול (כבד עוף → סו-וויד)

**קלט:** `Chicken_Liver`. פרופיל: ים תיכוני. ציוד: `["GRILL", "OVEN", "SOUS_VIDE"]`. המשתמש ביקש
לבדוק סו-וויד כדי לחסוך זמן עמידה ליד המנגל.

**ריצה:** המנוע מושך נתוני בסיס, מזהה את בקשת ההמרה, מפעיל את מנגנון ההמרות ומחשב. הוא בוחן את
פרופיל הטעם הים תיכוני (שום, שמן זית, טימין), מאשר שהוא מתאים מאוד לבישול בשקית ואקום, **אך מתריע
על המרקם** (בסו-וויד לא תהיה צריבה חיצונית).

**פלט:**
- **המלצת המרה:** ניתן לבצע בסו-וויד, אך זמן הבישול יתארך מ-5 דקות (בגריל) ל-45 דקות. **המרקם ייצא
  כבד אחיד ונימוח (כמו פטה), אך ללא קראסט חיצוני.**
- **נתיב נבחר:** הכנס את הכבדים לשקית עם שמן זית, שום וטימין. אין צורך בשלב סיום.

---

## §12 סיכום מנהלים — הניסוח המלא

- **מהות המוצר:** מערכת הפעלה לוגיסטית וקולינרית חכמה לפיטמאסטרים, מבוססת מדע המזון וחוקי התרמודינמיקה.
- **עמוד השדרה התהליכי:** המערכת **מפרידה לחלוטין** בין משתני טעם קולינריים (ראבים, מרינדות) לבין
  ניהול פיזיקלי קשיח של חום, לחות, זמן ומקום.
- **ערך מוסף (The Moat):**
  - אופטימיזציה מרחבית וזמנית מבוזרת.
  - ניהול משברים בזמן אמת (IoT Telemetry) — המערכת **אינה סטטית**.
  - ניהול מלאי מתכלים.
- **ארכיטקטורה נבחרת:** PWA היברידי (Offline-First) + Supabase (טבלאי קשיח לבטיחות ביולוגית + JSONB
  גמיש ללו"ז דינמי) + מנוע החוקים v5.0 כ-Cloudflare Worker + Gemini.
- **צעד ההמשך:** אחרי הטמעת המנוע והמעבר לשרתים — הסבה ל-React.

---

## §10 (הקשר בלבד — מחוץ לסקופ הדיון)

**המצב הנוכחי לפי המסמך:** "הפיילוט הקיים הוא אפליקציית קצה קדמי עשירה ומורכבת... **נכס ה-UI/UX כבר
קיים**: ריבוי שפות (i18n), מסכים עשירים ובחירת נתחים = **~70% מעבודת פיתוח ה-Front-End. אין סיבה
לזרוק אותם.**"

**"החוסר המרכזי: מנוע החוקים. כרגע האפליקציה פועלת כ'טופס חכם'. ברגע שנחבר את מנוע v5.0, הטופס
יתחיל לחשב, לשנות זמנים ולנהל משברים באופן עצמאי."**

**"המעבר אינו 'שכתוב מחדש', אלא תהליך ממוקד של הזרקת שרת כגיבוי (Server Augmentation) והטמעת מנוע
החוקים לתוך הקוד הקיים."**
