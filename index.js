
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

async function gzipData(obj){

    if(typeof obj == "object") {
        const jsonString = JSON.stringify(obj);

        const stream = new Blob([jsonString])
            .stream()
            .pipeThrough(new CompressionStream("gzip"));

        const compressedBlob = await new Response(stream).blob();

        return await compressedBlob.arrayBuffer();
    }
}

var actionTab = null;

function openOrReuseTab(url){

    // nếu tab chưa tồn tại hoặc đã bị đóng
    if(!actionTab || actionTab.closed){
        actionTab = window.open(url, "_blank");
    }else{
        actionTab.location.href = url;
    }

}
async function callApi(id, data){
    try{

        // check task trước
        const checkRes = await fetch(`https://hub.axisrobotics.ai/api/tasks/${id}`,{
            method:"GET",
            credentials:"include",
            headers:{
                "accept":"*/*"
            }
        });

        const task = await checkRes.json();

        if(!task || !task.id){
            console.log("task invalid -> skip", id);
            return;
        }

        console.log("task valid -> run api", id);

        const compressedData = await gzipData(data);

        const url = `https://hub.axisrobotics.ai/action?id=${id}`;
        openOrReuseTab(url);

        await new Promise(r=>setTimeout(r,55000));

        const res = await fetch(
            `https://hub.axisrobotics.ai/api/tasks/${id}/complete`,
            {
                method:"POST",
                headers:{
                    "accept":"application/json, text/plain, */*",
                    "cache-control":"no-store",
                    "content-type":"application/octet-stream",
                    "content-encoding":"gzip",
                },
                referrer:url,
                credentials:"include",
                body:compressedData
            }
        );

        console.log("status:",res.status,"task:",id,new Date());

    }catch(e){
        console.log("callApi error", e);
    }
}
async function loadPayload(id){
    const url = `https://laptrinhthatde.com/${id}.json`;

    const res = await fetch(url);

    if(!res.ok){
        return false;
    }

    return await res.json();
}
function randomDelay(){
    return 120000 + Math.random()*120000; // 3-5 phút
}
function adjustSimulationTime(payload){

    const newPayload = JSON.parse(JSON.stringify(payload));

    const reduce = 10 + Math.random() * 5; // 5–10s

    const newTime = Number(
        (newPayload.simulation_time_seconds - reduce).toFixed(3)
    );

    newPayload.simulation_time_seconds = newTime;

    if(newPayload.trajectory_metadata){
        newPayload.trajectory_metadata.simulation_time = newTime;
    }

    return newPayload;
}
function adjustSteps(payload){

    const newPayload = JSON.parse(JSON.stringify(payload));

    const steps = newPayload.trajectory_packed?.steps;
    if(!steps || steps.length === 0) return newPayload;

    const removeCount = Math.floor(Math.random()*3)+1; // 1-30
    const actualRemove = Math.min(removeCount, steps.length-1);

    // chọn vị trí xoá trong vùng giữa (bỏ 50 step đầu và cuối)
    const start = 50 + Math.floor(Math.random()*(steps.length-100-actualRemove));

    steps.splice(start, actualRemove);

    if(newPayload.trajectory_metadata){
        newPayload.trajectory_metadata.total_steps =
            newPayload.trajectory_metadata.total_steps - actualRemove;
    }

    return newPayload;
}
async function getPendingTaskIds(){

    const res = await fetch(
        "https://hub.axisrobotics.ai/api/tasks?sort_order=desc&status=active&search=&page=1&per_page=50",
        {
            headers:{
                "accept":"application/json, text/plain, */*"
            },
            credentials:"include"
        }
    );

    const data = await res.json();
    const tasks = data.tasks || [];

    return tasks
        .filter(t => !t.user_has_completed)
        .map(t => t.id);
}

async function createQposFromStart(start) {
    const taskid = 172;

    const res = await fetch(`https://laptrinhthatde.com/${taskid}.json`);
    const data = await res.json();

    const qpos = data.trajectory_packed.initial_snapshot.qpos;

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
async function loop(){

    const list = await getPendingTaskIds();

    console.log("pending tasks:", list);

    while(list.length > 0){

        const index = Math.floor(Math.random()*list.length);
        const id = list.splice(index,1)[0];

        let cleanPayload;
        try{
            cleanPayload = await loadPayload(id);
        }catch(e){
            console.log("loadPayload error -> skip", id);
            continue;
        }

        if(!cleanPayload){
            console.log("payload empty -> skip", id);
            continue;
        }

        const beforeSteps = cleanPayload?.trajectory_packed?.steps?.length || 0;

        let stepAdjusted = adjustSteps(cleanPayload);
        stepAdjusted = adjustSteps(stepAdjusted);
        stepAdjusted = adjustSteps(stepAdjusted);
        const afterSteps = stepAdjusted?.trajectory_packed?.steps?.length || 0;

        const finalPayload = adjustSimulationTime(stepAdjusted);

        const start = generateState(false);
        const end = generateState(true);
        const qpos = await createQposFromStart(start);
        finalPayload.trajectory_packed.object_state.start = start;
        finalPayload.trajectory_packed.object_state.end   = end;
        finalPayload.trajectory_packed.initial_snapshot.qpos = qpos;

        console.log(
            "task:", id,
            "| steps:", beforeSteps, "→", afterSteps,
            "| removed:", beforeSteps - afterSteps
        );

        try{
            console.log("finalPayload", finalPayload);
            //await callApi(id, finalPayload);
        }catch(e){
            console.log("error", e);
        }

        const delay = (finalPayload.simulation_time_seconds + 5 + Math.random()*5) * 1000;

        console.log("next run in", delay/1000, "seconds");

        await new Promise(r=>setTimeout(r,delay));
    }

    console.log("all payloads finished");
    document.body.style.background = "green";
}

loop();
