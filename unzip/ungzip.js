const fs = require("fs/promises");
const zlib = require("zlib");

// ===== gunzip function =====
function gunzip(buffer){
    return new Promise((resolve,reject)=>{
        zlib.gunzip(buffer,(err,result)=>{
            if(err) reject(err);
            else resolve(result.toString());
        });
    });
}

// ===== gzip function (để tạo file ví dụ) =====
function gzip(text){
    return new Promise((resolve,reject)=>{
        zlib.gzip(text,(err,result)=>{
            if(err) reject(err);
            else resolve(result);
        });
    });
}


async function decodeFile(){

    // đọc file gzip
    const data = await fs.readFile("unzip/172.txt");

    // gunzip
    const text = await gunzip(data);

    // parse json
    const json = JSON.parse(text);

    // ghi json ra file
    await fs.writeFile("unzip/172.json", JSON.stringify(json,null,2));

    console.log("✅ decoded → 172.json");
}

async function main(){
    // decode
    await decodeFile();

}

main().catch(console.error);