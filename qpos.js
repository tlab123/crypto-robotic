const fs = require('fs/promises');
const fsSync = require('fs');

// ====================== CONFIG ======================

const CONFIG = {
    maxOffset: 0.08,
    minDistance: 0.16
};

const objectList = ["model/", "jam_5/", "model_1/", "model_2/", "model_3/"];

// Robot joints
const ROBOT_JOINTS = [
    0, -0.785398, 0, -2.356194, 0, 1.570796, 0.785398, 0.04, 0.04
];

// ====================== CENTER POS ======================

const CENTER_POS = {
    "model/": [0.7269160151481628, 0.3107849955558777],
    "jam_5/": [0.6399930119514465, -0.23000800609588623],
    "model_1/": [0.5499749779701233, 0.0899910032749176],
    "model_2/": [0.4699999988079071, -0.05999999865889549],
    "model_3/": [0.7899439930915833, -0.3999289870262146]
};

// ====================== Random XY ======================

function generateRandomXYAround(centerX, centerY, existing) {

    let attempts = 0;

    while (attempts < 200) {

        attempts++;

        const x = centerX + (Math.random() * 2 - 1) * CONFIG.maxOffset;
        const y = centerY + (Math.random() * 2 - 1) * CONFIG.maxOffset;

        const newXY = [
            parseFloat(x.toFixed(16)),
            parseFloat(y.toFixed(16))
        ];

        if (existing.every(p =>
            Math.hypot(p[0] - newXY[0], p[1] - newXY[1]) >= CONFIG.minDistance
        )) {
            return newXY;
        }
    }

    return [centerX, centerY];
}

// ====================== Random Quaternion ======================

function randomQuaternion(maxTilt = 0.7) {

    const angle = Math.random() * maxTilt * Math.PI;

    let x = Math.random() - 0.5;
    let y = Math.random() - 0.5;
    let z = Math.random() - 0.5;

    const mag = Math.hypot(x, y, z) || 1;

    x /= mag;
    y /= mag;
    z /= mag;

    const s = Math.sin(angle / 2);
    const c = Math.cos(angle / 2);

    return [c, x * s, y * s, z * s];
}

// ====================== Generate State ======================

function generateState(isEnd = false) {

    const object_positions = {world: [0, 0, 0]};
    const object_orientations = {world: [1, 0, 0, 0]};

    const existing = [];

    for (const key of objectList) {

        const center = CENTER_POS[key];

        const [x, y] = generateRandomXYAround(center[0], center[1], existing);

        const pos = [x, y, 0]; // z sẽ lấy từ qpos gốc

        const maxTilt = isEnd
            ? (key === "model/" || key === "jam_5/" ? 0.92 : 0.55)
            : (key === "model/" || key === "jam_5/" ? 0.60 : 0.30);

        const quat = randomQuaternion(maxTilt);

        object_positions[key] = pos;
        object_orientations[key] = quat;

        object_positions[`${key}unnamed_body_0`] = [...pos];
        object_positions[`${key}object`] = [...pos];

        object_orientations[`${key}unnamed_body_0`] = [...quat];
        object_orientations[`${key}object`] = [...quat];

        if (key === "model/") {
            object_positions["model/Paprika012_Prop"] = [...pos];
            object_orientations["model/Paprika012_Prop"] = [...quat];
        }

        if (key === "model_1/") {
            object_positions["model_1/Mayonnaise005_Lid"] = [...pos];
            object_orientations["model_1/Mayonnaise005_Lid"] = [...quat];
        }

        if (key === "model_2/") {
            object_positions["model_2/model"] = [...pos];
            object_orientations["model_2/model"] = [...quat];
        }

        if (key === "model_3/") {
            object_positions["model_3/model"] = [...pos];
            object_orientations["model_3/model"] = [...quat];
        }

        existing.push([x, y]);
    }

    return {object_positions, object_orientations};
}

// ====================== Find Robot Index ======================

function findRobotIndex(qpos) {

    for (let i = 0; i <= qpos.length - ROBOT_JOINTS.length; i++) {

        let match = true;

        for (let j = 0; j < ROBOT_JOINTS.length; j++) {
            if (Math.abs(qpos[i + j] - ROBOT_JOINTS[j]) > 1e-9) {
                match = false;
                break;
            }
        }

        if (match) return i;
    }

    return -1;
}

// ====================== CREATE QPOS (NEW LOGIC) ======================

async function createQposFromStart(start) {
    const taskid = 172;

    const res = await fetch(`https://laptrinhthatde.com/${taskid}.json`);
    const data = await res.json();

    const qpos = data.trajectory_packed.initial_snapshot.qpos;

    console.log(111111);
    console.log(qpos);
    let robotIndex = -1;
    for(let i=0;i<=qpos.length-ROBOT_JOINTS.length;i++){

        let match = true;

        for(let j=0;j<ROBOT_JOINTS.length;j++){
            if(Math.abs(qpos[i+j] - ROBOT_JOINTS[j]) > 1e-9){
                match = false;
                break;
            }
        }

        if(match){
            robotIndex = i;
            break;
        }
    }

    if(robotIndex === -1){
        console.log("❌ Robot joints không tìm thấy");
        return qpos;
    }

    // ===== remove robot joints =====
    qpos.splice(robotIndex, ROBOT_JOINTS.length);

    // ===== random object pos =====
    for(let i=0;i<qpos.length;i+=7){

        qpos[i]   = randomize(qpos[i]);     // x
        qpos[i+1] = randomize(qpos[i+1]);   // y

        // z giữ nguyên
        // quat giữ nguyên
    }

    // ===== insert robot lại =====
    qpos.splice(robotIndex,0,...ROBOT_JOINTS);

    return qpos;
}
function randomize(n){

    let str = n.toString();

    if(str.includes("e")) return Number(n).toFixed(16);

    let [int, dec] = str.split(".");

    dec = dec || "";

    let keep = dec.slice(0,2);

    let randLen = 16 - 2; // còn lại 14 digit
    let rand = "";

    for(let i=0;i<randLen;i++){
        rand += Math.floor(Math.random()*10);
    }

    return parseFloat(Number(`${int}.${keep}${rand}`).toFixed(16));
}
// ====================== MAIN ======================

async function main() {

    const start = generateState(false);
    const end = generateState(true);

    const qpos = await createQposFromStart(start);

    const scene = {

        start,
        end,

        initial_snapshot: {

            time: 0,

            qpos: qpos,

            qvel: new Array(qpos.length).fill(0),

            ctrl: [...ROBOT_JOINTS],

            act: null,

            qacc_warmstart: new Array(qpos.length).fill(0),

            qfrc_applied: new Array(qpos.length).fill(0),

            xfrc_applied: new Array(162).fill(0),

            userdata: null,

            mocap_pos: null,
            mocap_quat: null
        }
    };

    await fs.writeFile(
        "random_scene_start_end_with_qpos.json",
        JSON.stringify(scene, null, 2)
    );

    console.log("✅ Scene generated with dynamic qpos");
}

main().catch(err => console.error(err));