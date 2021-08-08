// live.js
var live = null;
axios.get("/api/comm/initData",{}).then((initData)=>{
    let resData = initData.data;

    //init swiperOther
    function reCaculateSwiperOther(direction, slidesPerView){
        if(window.swiperOther){
          window.swiperOther.destroy(true,true);
        }
        var swiperOther = new Swiper('.swiperOther', {
            direction: direction,
            loop: false,
            slidesPerView: slidesPerView,
            observer: true,
        })
        window.swiperOther = swiperOther;
    }
  
    setTimeout(() => {
        let clientWidth = document.body.clientWidth;
        let slidesPerView = parseInt((clientWidth / 100))-2;
        //swiper count
        if(slidesPerView >= 5){
            slidesPerView = 5;
        }

        if(clientWidth >= 700){
            reCaculateSwiperOther("vertical",slidesPerView)
        }else{
            reCaculateSwiperOther("horizontal",slidesPerView)
        }
    })

    setTimeout(() => {
        let clientWidth = document.body.clientWidth;
        let slidesPerView = parseInt((clientWidth / 100))-2;
        //swiper count
        if(slidesPerView >= 5){
            slidesPerView = 5;
        }
        
        if(clientWidth >= 700){
            reCaculateSwiperOther("vertical",slidesPerView)
        }else{
            reCaculateSwiperOther("horizontal",slidesPerView)
        }
    },500)


    //init swiperComment
    function reCaculateSwiperComment(direction, slidesPerView){
        if(window.swiperComment){
          window.swiperComment.destroy(true,true);
        }
        var swiperComment = new Swiper('.swiperComment', {
            direction: direction,
            loop: false,
            slidesPerView: slidesPerView,
            observer: true,
        })
        window.swiperComment = swiperComment;
    }
  
    setTimeout(() => {
        reCaculateSwiperComment("vertical",5)
    },100)

    setTimeout(() => {
        reCaculateSwiperComment("vertical",5)
    },600)

    live = new Vue({
        el : '#liveApp',
        data : function () {
            let socket = null;
            if (io){
                socket = io(resData.wsHost);
            }
            return{
                socket : socket,
                socketId : 0,
                config : resData.rtcConfig,
                options : resData.options,
                userMediaConfig : {
                    audio: {
                        echoCancellation : true
                    },
                    video: true
                },
                expand : {
                    bindwidth : {
                        timestampPrev : 0,
                        bytesPrev : 0,
                        bitrate : 0
                    },
                    cssFilter : {
                        cssFilterChoose : 'none',
                        cssFilterList : [{
                            name : '无',
                            value : 'none'
                        },{
                            name : '模糊',
                            value : 'blur'
                        },{
                            name : '灰色',
                            value : 'grayscale'
                        },{
                            name : '反色',
                            value : 'invert'
                        },{
                            name : '棕褐色',
                            value : 'sepia'
                        }]
                    },
                    videoTape : {
                        errorMsg : '',
                        videoText : '开始录像',
                        recordedBlobs : [],
                        mediaRecorder : new Object(),
                        sourceBuffer : new Object(),
                        mediaSource : new MediaSource(),
                    },
                },
                createDisabled : false,
                exitDisabled : true,
                createClass : 'layui-btn layui-btn-normal layui-btn-radius',
                exitClass : 'layui-btn layui-btn-danger layui-btn-radius',
                disableClass : ' layui-btn-disabled',
                showTools :0,
                selfVideoStyle : "width:80%;margin-left:10%",

                messageSendTo : "",
                messageContent : "",
                roomId : 10086,
                recoderId : 0,
                rtcConns : {},
                remoteVideoList : [], //存储远程连接
                remoteVideoMap : {}, //id对应的连接索引
                localStream : null,
                msgList : [], //消息列表
            }
            
        },
        methods : { 
            createRoom : function () {
                if (this.roomId) {
                    this.socket.emit('createAndJoin', { room: this.roomId });
                    this.createDisabled = true;
                    this.exitDisabled = false;
                }
                this.remoteVideoList.push({
                    id : this.roomId,
                    name : "自己"
                })
            },
            exitRoom : function () {
                if (this.roomId) {
                    this.socket.emit('exit', {
                        from : this.socketId,
                        room: this.roomId,
                        recoderId : this.recoderId
                    });
                }
                for (let i in this.rtcConns) {
                    let rtcConnect = this.rtcConns[i];
                    rtcConnect.close();
                    rtcConnect = null;
                }
                this.resetData();
            },
            resetData : function(){
                this.createDisabled = false;
                this.exitDisabled = true;
                this.createClass = 'layui-btn layui-btn-normal layui-btn-radius';
                this.exitClass = 'layui-btn layui-btn-danger layui-btn-radius';
                this.disableClass = ' layui-btn-disabled';
                this.showTools =0;

                this.roomId = 1;
                this.recoderId = 0;
                this.rtcConns = {};
                this.remoteVideoList = []; //存储远程连接
                this.remoteVideoMap = {}; //id对应的连接索引
                this.localStream = null;
            },
            getRtcConnect : function(id){
                return this.rtcConns[id];
            },
            createRtcConnect : function (id) {
                let that = this;
                let rtcConnect = new RTCPeerConnection(this.config);
                rtcConnect.onicecandidate = (e) => {
                    that.iceCandidate(rtcConnect, id, e)
                };
                //设置获取对端stream数据回调--track方式
                rtcConnect.ontrack = (e) => {
                    that.trackStream(rtcConnect, id, e)
                };
                if (that.localStream != null) {
                    that.localStream.getTracks().forEach(function (track) {
                        rtcConnect.addTrack(track, that.localStream);
                    });
                }
                //设置获取对端stream数据回调
                rtcConnect.onremovestream = (e) => {
                    that.removeStream(rtcConnect, id, e)
                };
                //保存peer连接
                that.rtcConns[id] = rtcConnect;
                return rtcConnect;
            },
            getOrCreateRtcConnect : function(id){
                let rtcConnect = this.getRtcConnect(id);
                if (typeof (rtcConnect) == 'undefined'){
                    rtcConnect = this.createRtcConnect(id);
                }
                return rtcConnect;
            },
            gotStream : function(stream){
                this.$refs['self-video'].srcObject = stream;
                this.localStream = stream;
                this.remoteVideoList.push({
                    id : this.roomId,
                    name : "房主"
                })
                this.$refs[this.roomId].srcObject = stream;
            },
            addStream : function (rtcConnect,id,event) {
                try{
                    if (this.remoteVideoMap[id] == undefined) {
                        this.remoteVideoList.push({
                            id : id,
                            srcObject : event.streams
                        })
                        this.remoteVideoMap[id] = this.remoteVideoList.length-1;
                    }
                    if(this.$refs[id] != undefined){
                        this.$refs[id]['0'].srcObject = event.streams;
                    }
                }catch(e){
                    console.error('addStream error : ',e);
                }
            },
            trackStream : function (rtcConnect,id,event) {
                try{
                    if (this.remoteVideoMap[id] == undefined) {
                        this.remoteVideoList.push({
                            id : id,
                            srcObject : event.streams[0]
                        })
                        this.remoteVideoMap[id] = this.remoteVideoList.length-1;
                    }
                    if(this.$refs[id] != undefined){
                        this.$refs[id]['0'].srcObject = event.streams[0];
                    }
                }catch(e){
                    console.error('trackStream error : ',e);
                }
            },
            removeStream : function(rtcConnect,id,event){
                this.getOrCreateRtcConnect(id).close;
                delete this.rtcConns[id];
                //移除video
                delete this.remoteVideoList[this.remoteVideoMap[id]]
                delete this.remoteVideoMap[id];
            },
            iceCandidate : function (rtcConnect,id,event) {
                if (event.candidate != null) {
                    let message = {
                        from : this.socketId,
                        to : id,
                        room : this.roomId,
                        sdpMid : event.candidate.sdpMid,
                        sdpMLineIndex : event.candidate.sdpMLineIndex,
                        sdp : event.candidate.candidate
                    };
                    this.socket.emit('candidate', message);
                }
            },
            offerSuccess : function (rtcConnect,id,offer) {
                //设置本地setLocalDescription
                rtcConnect.setLocalDescription(offer).then(r => {})
                let message = {
                    from : this.socketId,
                    to : id,
                    room : this.roomId,
                    sdp : offer.sdp
                };
                this.socket.emit('offer', message);
            },
            offerFailed : function (rtcConnect,id,error) {
            },
            answerSuccess : function (rtcConnect,id,offer) {
                //设置本地setLocalDescription
                rtcConnect.setLocalDescription(offer).then(r => {});
                let message = {
                    from : this.socketId,
                    to : id,
                    room : this.roomId,
                    sdp : offer.sdp
                };
                this.socket.emit('answer', message);
            },
            answerFailed : function (rtcConnect,id,error) {
            },
            addIceCandidateSuccess : function(res){
            },
            addIceCandidateFailed : function(err){
            },
            startCameraSuccess : function (res) {
                this.gotStream(res);
            },
            startCameraFailed : function (res) {
                console.log("启动摄像头失败",res);
                // alert("你没有摄像头")
                this.createDisabled = false;
            },
            startCamera : function () {
                let that = this;
                if (this.localStream == null) {
                    navigator.mediaDevices.getUserMedia(this.userMediaConfig).then(res => {
                        that.startCameraSuccess(res);
                    }).catch(res => {
                        that.startCameraFailed(res);
                    });
                }
            },
            socketListener : function () {
                let that = this;
                //created [id,room,peers]
                this.socket.on('created', async function (data) {
                    that.touchResize();
                    console.log('created: ' + JSON.stringify(data));
                    //根据回应peers 循环创建WebRtcPeerConnection & 发送offer消息 [from,to,room,sdp]
                    that.socketId = data.id;
                    that.roomId = data.room;
                    that.recoderId = data.recoderId;
                    for (let i = 0; i < data['peers'].length; i++) {
                        let otherSocketId = data['peers'][i].id;
                        //创建WebRtcPeerConnection
                        let rtcConnect = that.getOrCreateRtcConnect(otherSocketId);
                        //设置offer
                        rtcConnect.createOffer(that.options).then(offer => {
                            that.offerSuccess(rtcConnect, otherSocketId, offer);
                        }, error => {
                            that.offerFailed(rtcConnect, otherSocketId, error);
                        });
                    }
                });

                //joined [id,room]
                this.socket.on('joined', function (data) {
                    that.touchResize();
                    console.log('joined: ' + JSON.stringify(data));
                    that.getOrCreateRtcConnect(data.from);
                });

                //offer [from,to,room,sdp]
                this.socket.on('offer', function (data) {
                    //获取peer
                    let rtcConnect = that.getOrCreateRtcConnect(data.from);
                    //构建RTCSessionDescription参数
                    let rtcDescription = { type: 'offer', sdp: data.sdp };
                    //设置远端setRemoteDescription
                    rtcConnect.setRemoteDescription(new RTCSessionDescription(rtcDescription)).then(r => {});
                    //createAnswer
                    rtcConnect.createAnswer(that.options).then((offer) => {
                        that.answerSuccess(rtcConnect, data.from, offer)
                    }).catch((error) => {
                        that.answerFailed(rtcConnect, data.from, error)
                    });
                });

                //answer [from,to,room,sdp]
                this.socket.on('answer', function (data) {
                    //获取peer
                    let rtcConnect = that.getOrCreateRtcConnect(data.from);
                    //构建RTCSessionDescription参数
                    let rtcDescription = { type: 'answer', sdp: data.sdp };
                    //设置远端setRemoteDescription
                    rtcConnect.setRemoteDescription(new RTCSessionDescription(rtcDescription)).then(r => {});
                });

                //candidate  [from,to,room,candidate[sdpMid,sdpMLineIndex,sdp]]
                this.socket.on('candidate', function (data) {
                    //获取Peer
                    let rtcConnect = that.getOrCreateRtcConnect(data.from);
                    let rtcIceCandidate = new RTCIceCandidate({
                        candidate: data.sdp,
                        sdpMid: data.sdpMid,
                        sdpMLineIndex: data.sdpMLineIndex
                    });
                    //添加对端Candidate
                    rtcConnect.addIceCandidate(rtcIceCandidate).then(res => {
                        that.addIceCandidateSuccess(res);
                    }).catch(error => {
                        that.addIceCandidateFailed(error);
                    });
                });

                //exit [from,room]
                this.socket.on('exit', function (data) {
                    that.touchResize();
                    console.log('exit: ' + JSON.stringify(data));
                    //判断是否为当前连接
                    var rtcConnect = that.rtcConns[data.from];
                    if (typeof (rtcConnect) == 'undefined') {
                        return;
                    } else {
                        //peer关闭
                        that.getOrCreateRtcConnect(data.from).close;
                        //删除peer对象
                        delete that.rtcConns[data.from];
                        //移除video
                        Vue.delete(that.remoteVideoList,that.remoteVideoMap[data.from]);
                        that.remoteVideoMap[data.from];
                    }
                });
            },
            canvasHandler : function () { 
                let selfVideo =  this.$refs['self-video'];
                let selftCanvas = this.$refs['self-canvas'];
                selftCanvas.width = 230;
                selftCanvas.height = 200;
                selftCanvas.className = this.expand.cssFilter.cssFilterChoose;
                selftCanvas.getContext('2d').drawImage(selfVideo, 0, 0, selftCanvas.width, selftCanvas.height);
            },
            videoTapeHandler : async function() {
                let videoTape = this.expand.videoTape;

                if(videoTape.videoText === '停止录像'){
                    videoTape.mediaRecorder.stop();
                    this.$refs['self-video-tape'].disabled = true;
                    this.$refs['self-video-play'].disabled = false;
                    this.$refs['self-video-download'].disabled = false;
                    return;
                }
                videoTape.recordedBlobs = [];
                let options = {mimeType: 'video/webm;codecs=vp9'};
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    videoTape.errorMsg = `${options.mimeType} is not Supported`;
                options = {mimeType: 'video/webm;codecs=vp8'};
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    videoTape.errorMsg = `${options.mimeType} is not Supported`;
                    options = {mimeType: 'video/webm'};
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                        videoTape.errorMsg = `${options.mimeType} is not Supported`;
                        options = {mimeType: ''};
                    }
                }
                }
            
                try {
                    videoTape.mediaRecorder = new MediaRecorder(this.localStream, options);
                } catch (e) {
                    videoTape.errorMsg = `Exception while creating MediaRecorder: ${JSON.stringify(e)} ${JSON.stringify(options)}`;
                    return;
                }
                
                console.log('Created MediaRecorder',videoTape.mediaRecorder, 'with options', options);
                videoTape.videoText = '停止录像';
                this.$refs['self-video-play'].disabled = true;
                this.$refs['self-video-download'].disabled = true;

                videoTape.mediaRecorder.onstop = (event) => {
                //   console.log('Recorder stopped: ', event);
                //   console.log('Recorded Blobs: ', videoTape.recordedBlobs);
                };
                videoTape.mediaRecorder.ondataavailable = (event) => {
                    // console.log('handleDataAvailable', event);
                    if (event.data && event.data.size > 0) {
                        videoTape.recordedBlobs.push(event.data);
                    }
                };
                videoTape.mediaRecorder.start(10); // collect 10ms of data
                console.log('MediaRecorder started', videoTape.mediaRecorder);
            },
            videoPlayHandler : function () {
                let videoTape = this.expand.videoTape;
                const superBuffer = new Blob(videoTape.recordedBlobs, {type: 'video/webm'});
                let tapeVido = this.$refs['self-video-tape-video'];
                tapeVido.src = null;
                tapeVido.srcObject = null;
                tapeVido.src = window.URL.createObjectURL(superBuffer);
                tapeVido.controls = true;
                tapeVido.play();
            },
            videoDownLoadHandler : function(){
                let videoTape = this.expand.videoTape;
                const blob = new Blob(videoTape.recordedBlobs, {type: 'video/webm'});
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'test.webm';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                }, 100);
            },
            caculateBindWidth : function () {  
                let that = this;
                setInterval(() => {
                    for (let i in that.rtcConns) {
                        let rtcConnect = this.rtcConns[i];
                        rtcConnect.getStats(null).then((res)=>{
                            res.forEach(report => {
                                const now = report.timestamp;
                                let bitrate = 0;
                                if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                                const bytes = report.bytesReceived;
                                if (that.expand.bindwidth.timestampPrev) {
                                    bitrate = 8 * (bytes - that.expand.bindwidth.bytesPrev) / (now - that.expand.bindwidth.timestampPrev);
                                    bitrate = Math.floor(bitrate);
                                }
                                that.expand.bindwidth.bytesPrev = bytes;
                                that.expand.bindwidth.timestampPrev = now;
                                if(bitrate){
                                    that.expand.bindwidth.bitrate = bitrate/2;
                                }
                                }
                            });
                        }, err => console.log(err));
                    }
                }, 2000);
            },
            reCaculateSwiperSize : function () {
                let clientWidth = document.body.clientWidth;
                let slidesPerView = parseInt((clientWidth / 100));
                
                //swiper count
                if(slidesPerView >= 5){
                    slidesPerView = 5;
                }
                
                //swiper css
                if(clientWidth >= 700){
                    reCaculateSwiperOther("vertical",slidesPerView)
                }else{
                    reCaculateSwiperOther("horizontal",slidesPerView)
                }

                //selfvideo css
                let selfVideoStyleLimit = parseInt((clientWidth - 700) / 100);
                let widthPersent = 80-selfVideoStyleLimit*5;
                if(widthPersent <= 40){
                    widthPersent = 40;
                }
                if(widthPersent >= 70){
                    widthPersent = 70;
                }
                if(clientWidth < 700){
                    this.selfVideoStyle = `width:${80}%;`;
                    this.selfVideoStyle += `margin-left:${10}%`;
                }else{
                    this.selfVideoStyle = `width:${widthPersent}%;`;
                    if(widthPersent === 40){
                        this.selfVideoStyle += `margin-left:${10}%`;
                    }
                    if(clientWidth > 1500){
                        this.selfVideoStyle = `width:${widthPersent}%;`;
                    }
                }
            },
            touchResize : function() {
                let that = this;
                setTimeout(()=>{
                    var myEvent = new Event('resize');
                    window.dispatchEvent(myEvent);
                    that.reCaculateSwiperSize();
                },100)
            }
        },
        created : function () {
            // this.caculateBindWidth();
        
        },
        mounted : function () {
            this.startCamera();
            this.socketListener();
            window.onresize = this.reCaculateSwiperSize;
            this.reCaculateSwiperSize()
        },
        destroyed : function () {
        }
    });
});


// window.onbeforeunload = function () {
//     return "Do you really want to close?";
// };