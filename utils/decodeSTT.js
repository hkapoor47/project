import protobuf from "protobufjs";

let messageType;

protobuf.load("/proto/stt.proto").then((root)=>{
    messageType = root.lookupType("agora.stt.SpeechToText");
});


export function decodeSTT(data){

    const message = messageType.decode(data);

    return message;
}