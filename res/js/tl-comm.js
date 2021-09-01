

//socket
(()=>{

    var tlSocket = {};

    tlSocket.init = function(socket,id){
        tlSocket.socket = socket;
        tlSocket.id = id;
    }

    tlSocket.on = function(type , callback){
        tlSocket.socket.on(type, callback);
    }
    tlSocket.onCreated = function(callback){
        tlSocket.on("created", callback);
    }
    tlSocket.onJoined = function(callback){
        tlSocket.on("joined", callback);
    }
    tlSocket.onOffer = function(callback){
        tlSocket.on("offer", callback);
    }
    tlSocket.onAnswer = function(callback){
        tlSocket.on( "answer", callback);
    }
    tlSocket.onCandidate = function(callback){
        tlSocket.on("candidate", callback);
    }
    tlSocket.onExit = function(callback){
        tlSocket.on("exit", callback);
    }
    tlSocket.emit = function(type , data){
        tlSocket.socket.emit(type, data);
    }
    tlSocket.emitCreate = function( data){
        tlSocket.emit( "created", data);
    }
    tlSocket.emitJoin = function( data){
        tlSocket.emit("joined", data);
    }
    tlSocket.emitOffer = function( data){
        tlSocket.emit("offer", data);
    }
    tlSocket.emitAnswer = function( data){
        tlSocket.emit("answer", data);
    }
    tlSocket.emitCandidate = function( data){
        tlSocket.emit("candidate", data);
    }
    tlSocket.emitExit = function( data){
        tlSocket.emit("exit", data);
    }
    tlSocket.emitCreateAndJoin = function( data){
        tlSocket.emit("createAndJoin", data);
    }

    window.tlSocket = tlSocket;
})();




//webrtc
(()=>{

    var tlWebrtc = {};

    tlWebrtc.init = function(config, options, stream, connects){
        tlWebrtc.config = config;
        tlWebrtc.options = options;
        tlWebrtc.LOCAL_STREAM = stream;
        tlWebrtc.connects = connects;
    }

    tlWebrtc.initStream = function(stream){
        document.querySelector("#self-video").srcObject = stream;
        if(!!navigator.userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/)){
            document.querySelector("#self-video").play();
        }
        tlWebrtc.LOCAL_STREAM = stream;
    }

    tlWebrtc.addConnect = function(connect, id){
        tlWebrtc.connects.push({
            id : id,
            connect : connect
        })
        tlVue.Bus.$emit("addConnect",tlWebrtc.connects);
    }

    tlWebrtc.removeConnect = function(id){
        let connect = tlWebrtc.getConnect(id);
        if(connect){
            connect.close();
        }
        tlWebrtc.connects = tlWebrtc.connects.filter((item)=>{
            return item.id !== id;
        })
    }

    tlWebrtc.createConnect = function(id){
        if(!tlWebrtc.LOCAL_STREAM){
            tlLayer.msg("LOCAL_STREAM err");
            return;
        }

        let connect = new RTCPeerConnection(tlWebrtc.config);

        connect.onicecandidate = (event) => {
            if(event.candidate){
                tlWebrtc.iceCandidateSuccess(id,event.candidate);
            }
        };

        connect.ontrack = (event) => {
            let conn = tlWebrtc.getConnect(id);
            if(!conn){
                tlWebrtc.addConnect(conn, id);
            }
            setTimeout(()=>{
                let dom = document.querySelector("#tl"+id);
                dom.srcObject = event.streams[0];
                if(!!navigator.userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/)){
                    dom.play();
                }
            },100)
        };

        tlWebrtc.LOCAL_STREAM.getTracks().forEach(function (track) {
            connect.addTrack(track, tlWebrtc.LOCAL_STREAM);
        });

        connect.onremovestream = (event) => {
            tlWebrtc.removeConnect(id)
        };

        tlWebrtc.addConnect(connect, id);
    }

    tlWebrtc.getConnect = function(id){
        let connectObj = tlWebrtc.connects.filter((item)=>{
            return item.id === id;
        });
        if(connectObj && connectObj.length === 1){
            return connectObj[0].connect;
        }
        return null;
    }

    tlWebrtc.getOrCreateConnect = function(id){
        let connect = tlWebrtc.getConnect(id);
        if(!connect){
            tlWebrtc.createConnect(id);
        }
        return tlWebrtc.getConnect(id);
    }

    tlWebrtc.createPeers = function(data){
        let peers = data.peers || [];
        tlSocket.id = data.id;
        tlRoom.id = data.room;
        for (let i = 0; i < peers.length; i++) {
            let peer = peers[i].id;
            let connect = tlWebrtc.getOrCreateConnect(peer);
            connect.createOffer(tlWebrtc.options).then(offer => {
                tlWebrtc.offerSuccess(peer, offer);
            }).catch(error => {
                console.error("err in createPeers" + peer, error);
            });
        }
    }


    tlWebrtc.joinPeers = function(data){
        let connect = tlWebrtc.getOrCreateConnect(data.id);
    }

    tlWebrtc.offer = function(data){
        let connect = tlWebrtc.getOrCreateConnect(data.from);
        let description = { type: 'offer', sdp: data.sdp };
        connect.setRemoteDescription(new RTCSessionDescription(description)).then(res => {

        });
        connect.createAnswer(tlWebrtc.options).then((offer) => {
            tlWebrtc.answerSuccess(data.from, offer)
        }).catch(error => {
            console.error("err in offer " + data.from, error);
        });
    }

    tlWebrtc.answer = function(data){
        let connect = tlWebrtc.getOrCreateConnect(data.from);
        let description = { type: 'answer', sdp: data.sdp };
        connect.setRemoteDescription(new RTCSessionDescription(description)).then(res => {
            
        }).catch(error => {
            console.error("err in answer " + data.from, error);
        });
    }

    tlWebrtc.candidate = function(data){
        let connect = tlWebrtc.getOrCreateConnect(data.from);
        let ice = new RTCIceCandidate({
            candidate: data.sdp,
            sdpMid: data.sdpMid,
            sdpMLineIndex: data.sdpMLineIndex
        });
        connect.addIceCandidate(ice).then(res => {
            
        }).catch(error => {
            console.error("err in candidate " + data.from, error);
        });
    }

    tlWebrtc.offerSuccess = function(id, offer){
        let connect = tlWebrtc.getConnect(id);
        if(connect){
            connect.setLocalDescription(offer).then(res => {})
            tlSocket.emitOffer( {
                from : tlSocket.id,
                to : id,
                room : tlRoom.id,
                sdp : offer.sdp
            });
        }
    }

    tlWebrtc.answerSuccess = function(id, offer){
        let connect = tlWebrtc.getConnect(id);
        if(connect){
            connect.setLocalDescription(offer).then(res => {});
            tlSocket.emitAnswer({
                from : tlSocket.id,
                to : id,
                room : tlRoom.id,
                sdp : offer.sdp
            });
        }
    }

    tlWebrtc.iceCandidateSuccess = function(id, candidate){
        tlSocket.emitCandidate({
            from : tlSocket.id,
            to : id,
            room : tlRoom.id,
            sdpMid : candidate.sdpMid,
            sdpMLineIndex : candidate.sdpMLineIndex,
            sdp : candidate.candidate
        })
    }

    window.tlWebrtc = tlWebrtc;
})();



//layer
(()=>{

    var tlLayer = {};

    tlLayer.msg = function(content){
        if(window.layer){
            window.layer.msg(content);
        }else{
            alert(content);
        }
    }

    tlLayer.close = function(index){
        if(window.layer){
            window.layer.close(index);
        }
    }

    tlLayer.confirm = function(content, success, cancel){
        if(window.layer){
            window.layer.confirm(content, {
                btn: ['进入','退出'],
            }, success, cancel);
        }else{
            window.confirm(content);
        }
    }

    window.tlLayer = tlLayer;
})();



//room
(()=>{

    var tlRoom = {};

    
    tlRoom.init = function(id, callback){
        tlRoom.id = id;
        setTimeout(async ()=>{
            let success = await tlRoom.getVideoStream();
            if(callback){
                callback(success);
            }
        },500)
    }

    //get video stream
    tlRoom.getVideoStream = async function(){
        let media = navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation : true
            },
            video: true
        });

        let stream = null;
        try{
            stream = await media;
        }catch(error){
            console.error(error)
        }

        if(stream == null){
            tlLayer.msg("get stream err");
            return false;
        }

        tlWebrtc.initStream(stream);

        return true;
    }

    window.tlRoom = tlRoom;
})();



//qrcode
(()=>{

    var tlQrcode = {};

    tlQrcode.code = function(content){
        return "https://blog.iamtsm.cn/share/code/url?url="+encodeURIComponent(content);
    }


    window.tlQrcode = tlQrcode;
})();



//vue
(()=>{

    var tlVue = {};

    
    tlVue.init = function(){
        tlVue.Bus = new Vue({});
    }

    window.tlVue = tlVue;
})();


//swiper
(()=>{
    var tlSwiper = {};

    tlSwiper.init = function(){
        tlSwiper.SLIDE_COUNT = 5; //slide 一屏数量
        tlSwiper.MIN_WIDTH = 700; //切换样式最小px
        tlSwiper.VERTICAL = "vertical";    //..
        tlSwiper.HORIZONTAL = "horizontal";    //..
        tlSwiper.doms = []; //
    }


    //swiper一屏数量    
    tlSwiper.count = function(){
        let clientWidth = document.body.clientWidth;
        let count = parseInt((clientWidth / 100))-2;
       
        if(count >= tlSwiper.SLIDE_COUNT){
            count = tlSwiper.SLIDE_COUNT;
        }
        return count;
    }
    
    //初始化swiper
    tlSwiper.autoPreview = function(domClass){ 
        setTimeout(()=>{
            let clientWidth = document.body.clientWidth;
            if(clientWidth >= tlSwiper.MIN_WIDTH){
                tlSwiper.prepare(domClass, tlSwiper.VERTICAL)
            }else{
                tlSwiper.prepare(domClass,tlSwiper.HORIZONTAL)
            }
        },800)
    }

    //初始化swiper
    tlSwiper.preview = function(domClass, direction){ 
        setTimeout(()=>{
            tlSwiper.prepare(domClass, direction);
        },800)
    }


    //设置swiper
    tlSwiper.prepare = function(domClass, direction){
        if(tlSwiper.doms[domClass]){
            tlSwiper.doms[domClass].destroy(true,true);
        }
        var swiperDom = new window.Swiper(domClass, {
            direction: direction,
            loop: false,
            slidesPerView: tlSwiper.count(),
            observer: true,
        })
        
        tlSwiper.doms[domClass] = swiperDom;
    }


    window.tlSwiper = tlSwiper;
})();



