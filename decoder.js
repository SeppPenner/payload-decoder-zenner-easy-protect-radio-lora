// Definition of the different packet types and subtypes.
let TYPE_SP1 = 0x1; //sent daily -> packet, max. 2 retransmissions
let TYPE_SP9 = 0x9; // Sent immediately after first  activation and from then on every 6 months -> No retransmissions
let SUBTYPE_SP9_1 = 0x01; // sent every month except the month of first activation -> No retransmissions
let SUBTYPE_SP9_2 = 0x02; // sent immediately after first activation and from then on every 6 months -> No retransmissions
let TYPE_AP1 = 0xA; //  (status code, status data): event based -> Max 5 AP packets per month, no retransmissions

// Definition of head line daily value.
/* let S_SMOKE_CHAMBER_POLLUTION_PREWARNING = 0x0800;
 let S_SMOKE_CHAMBER_POLLUTION_WARNING = 0x1000;
 let S_TEST_BUTTON_FAILUER = 0x2000;
 let S_ACCUSTIC_ALARM_FAILUER = 0x4000;
 let S_REMOVAL_DETECTION = 0x8000;
 let S_TEST_ALARM = 0x0001;
 let S_SMOKE_ALARM = 0x0002;
 let S_OBSTRUCTION_DETECTION = 0x0004;
 let S_SURROUNDING_AREA_MONITORING = 0x0008;
 let S_LED_FAILURE = 0x0010;*/

// Device specific status summery definition
let A_REMOVAL = 0x02;
let A_BATTERY_END_OF_LIFE = 0x0C;
let A_HORN_DRIVE_LEVEL_FAILURE = 0x16;
let A_OBSTRUCTION_DETECTION = 0x1A;
let A_OBJECT_IN_THE_SURROUNDING_AREA = 0x1C;
let ap_values = ["removal", "battery end of life",
    "horn drive level failure", "obstruction detection", "object in the surrounding area"];

/**
 * decodes date (EN13757-3:2013, Annex A, data type G).
 * input: int, lower two bytes interpreted.
 * output: date string YYYY-MM-DD.
 * @param bytes
 * @returns {string}
 */
function decodeDate(bytes) {
    //TODO Handling errors with 0xFF see LoRa radio packet definitions page 15
    let day = (bytes & 0x1F00) >> 8;
    let month = (bytes & 0x000F);
    let year = ((bytes & 0xE000) >> 10) | ((bytes & 0x00F0) >> 4);
    return "20" + year.toString() + "-" + month.toString() + "-" + day.toString();
}

/**
 * Date and time format.
 * Date&Time stamp coding according to EN13757-3:2013, Annex A, data type F
 * @param bytes
 * @returns {string}
 */
function decodeDateAndTime(bytes) {
    let minute = (bytes & 0x3F000000) >> 24;
    let hour = (bytes & 0x001F0000) >> 16;
    let day = (bytes & 0x00001F00) >> 8;
    let month = (bytes & 0x0000000F);
    let year = ((bytes & 0x0000E000) >> 10) | ((bytes & 0x000000F0) >> 4); //TODO fix HYF (Hundred Year Format)
    return "20" + year.toString() + "-"
        + month.toString() + "-"
        + day.toString() + "T"
        + hour.toString() + ":"
        + minute.toString()
        + ":00Z";
}

/**
 * Build the summary for package 9.1.
 * @param a
 * @param b
 * @returns {[]}
 */
function buildStatusSummery(a, b) {
    let values = ["removal", undefined,
        "battery end of life", "acoustic alarm failure",
        "obstruction detection", "surrounding area monitoring"];
    let bin1 = (convertNumber(a.toString(16), 16, 2));
    let bin2 = (convertNumber(b.toString(16), 16, 2));
    let result = [];

    for (let i = 0; i < bin1.length; i++) {
        if (bin1[i] === "1") {
            result.push(values[i]);
        }
    }

    for (let i = 0; i < bin2.length; i++) {
        if (bin2[i] === "1") {
            result.push(values[i]);
        }
    }

    return result;
}

/**
 * Used in status_summery
 * @param n
 * @param fromBase
 * @param toBase
 * @returns {string}
 */
function convertNumber(n, fromBase, toBase) {
    if (fromBase === void 0) {
        fromBase = 10;
    }
    if (toBase === void 0) {
        toBase = 10;
    }
    return parseInt(n.toString(), fromBase).toString(toBase);
}

/**
 * Main decoder function
 * @param bytes
 * @constructor
 */
function Decoder(bytes) {
    //TODO include port in function call -> function Decoder(bytes, port) {...}
    let obj = {};

    switch (bytes[0] >> 4) {
        case TYPE_SP1:
            obj.packet_type = 1;
            obj.packet_subtype = 0;
            obj.packet_type_info = "sync";
            obj.timestamp = null;
            obj.status_interpretation = null;
            obj.status_dedcoded = true;
            obj.status_info = null;
            break;
        case TYPE_SP9:
            obj.packet_type = 9;
            obj.packet_subtype = null;
            obj.packet_type_info = "sync";
            obj.timestamp = null;
            obj.status_interpretation = null;
            obj.status_dedcoded = true;
            obj.status_info = null;
            break;
        case TYPE_AP1:
            obj.packet_type = 1;
            obj.packet_subtype = 0;
            obj.packet_type_info = "async";
            obj.timestamp = null;
            obj.status_interpretation = null;
            obj.status_dedcoded = true;
            obj.status_info = null;
            break;
        default:
            obj.packet_type = null;
            obj.packet_subtype = null;
            obj.packet_type_info = null;
            obj.timestamp = null;
            obj.status_interpretation = null;
            obj.status_dedcoded = false;
            obj.status_info = "Error at point: " + 0 + "payload_raw: " + bytes;
            break;
    }

    if (obj.packet_type === 9) {
        switch (bytes[0] & 0x0F) {
            case SUBTYPE_SP9_1:
                obj.packet_subtype = 1;
                obj.status_interpretation = buildStatusSummery(bytes[5], bytes[6]);
                obj.timestamp = decodeDateAndTime(
                    ((bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | (bytes[4]))
                );
                break;
            case SUBTYPE_SP9_2:
                obj.packet_subtype = 2;
                obj.status_interpretation = [
                    "firmware version: " + (
                        ((bytes[1] << 24) + (bytes[2] << 16) + (bytes[3] << 8) + (bytes[4]))
                            .toString(16)).toUpperCase(),
                    "LoRa WAN version: " + (bytes[5]).toString(16) + "." + (bytes[6])
                        .toString(16) + "." + (bytes[7]).toString(16),
                    "LoRa command version: " + (bytes[9]).toString(16) + "." + (bytes[8]).toString(16),
                    "device type: " + (bytes[10]).toString(16),
                    "meter ID: " + (((bytes[11] << 24) + (bytes[12] << 16) + (bytes[13] << 8) + (bytes[14]))
                        .toString(16)).toUpperCase()
                ];
                break;
            default:
                obj.status_dedcoded = false;
                obj.status_info = "Error at point: " + 0 + "payload_raw: " + bytes;
        }

    } else if (obj.packet_type === 1 && obj.packet_type_info === "async") {
        switch (bytes[1]) {
            case A_REMOVAL:
                obj.status_interpretation = ap_values[0];
                obj.timestamp = (decodeDate(bytes [3] << 8 | bytes[4]));
                break;
            case A_BATTERY_END_OF_LIFE:
                obj.status_interpretation = ap_values[1];
                break;
            case A_HORN_DRIVE_LEVEL_FAILURE:
                obj.status_interpretation = ap_values[2];
                break;
            case A_OBSTRUCTION_DETECTION:
                obj.status_interpretation = ap_values[3];
                break;
            case A_OBJECT_IN_THE_SURROUNDING_AREA:
                obj.status_interpretation = ap_values[4];
                obj.timestamp = (decodeDate((bytes [3] << 8) | bytes[4]));
                break;
            default:

        }
    } else if ((obj.packet_type === 1) && (obj.packet_type_info === "sync")) {
        //TODO Implement the SP1 package interpretation...

    }
    return obj;
}