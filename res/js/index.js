// video.js
var video = null;
axios.get(window.prefix + "/api/comm/initData",{}).then((initData)=>{
    let resData = initData.data;

    tlSwiper.init();
    //视频区
    tlSwiper.autoPreview(".swiperOther");
    //评论区
    tlSwiper.preview(".swiperComment",tlSwiper.VERTICAL);
    

    video = new Vue({
        el : '#videoApp',
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
                userMediaConfig : {audio: {echoCancellation : true},video: true},

                //css
                createDisabled : true,
                exitDisabled : true,
                createClass : 'layui-btn layui-btn-normal layui-btn-radius',
                exitClass : 'layui-btn layui-btn-danger layui-btn-radius',
                disableClass : ' layui-btn-disabled',
                showTools :0,
                selfVideoStyle : "width:80%;margin-left:10%",
                autoStyle : "",
                shareClass : "",

                //video
                messageSendTo : "",
                messageContent : "",
                roomId : 10086,
                remoteVideoList : [], //存储远程连接
                msgList : [], //消息列表,
            }
            
        },
        watch : {
            messageSendTo : function(newV, oldV){
                console.log(newV)
            },
            remoteVideoList : {
                deep : true,
                handler : function(newV ,oldV){
                }
            }
        },
        computed : {
            shareUrl : function(){ //分享二维码url
                return tlQrcode.code("https://im.iamtsm.cn/video?roomId="+this.roomId);
            }
        },
        methods : {
            //socket方法
            socketListener : function () {
                let that = this;

                tlSocket.onCreated((data)=>{
                    console.log('created: ' + JSON.stringify(data));
                    that.socketId = data.id;
                    that.roomId = data.room;
                    tlWebrtc.createPeers(data);
                    that.touchResize();
                })

                tlSocket.onJoined((data)=>{
                    console.log('joined: ' + JSON.stringify(data));
                    tlWebrtc.joinPeers(data);
                    that.touchResize();
                })

                tlSocket.onOffer(  tlWebrtc.offer )

                tlSocket.onAnswer( tlWebrtc.answer )

                tlSocket.onCandidate( tlWebrtc.candidate )

                tlSocket.onExit((data)=>{
                    console.log('exit: ' + JSON.stringify(data));
                    tlWebrtc.removeConnect(data.from);
                    that.touchResize();
                })
            },
            //创建，加入房间
            createRoom : function () {
                if (!this.roomId) {
                    return;
                }
                tlSocket.emitCreateAndJoin({
                    room: this.roomId
                })
                this.createDisabled = true;
                this.exitDisabled = false;
            },
            //退出房间
            exitRoom : function () {
                if (!this.roomId) {
                    return;
                }
                tlSocket.emitExit({
                    from : this.socketId,
                    room: this.roomId
                })
                this.createDisabled = false;
                this.exitDisabled = true;
                this.createClass = 'layui-btn layui-btn-normal layui-btn-radius';
                this.exitClass = 'layui-btn layui-btn-danger layui-btn-radius';
                this.disableClass = ' layui-btn-disabled';
                this.showTools = 0;

                this.roomId = 10086;
                this.remoteVideoList = []; //存储远程连接
            },
            //发送消息
            sendMsg : function(){
                this.messageContent = "";
                tlLayer.msg("暂不支持发送")
            },
            //分享房间
            shareRoom : function () {
                if(!this.shareClass){
                    this.shareClass = "shareClass";
                }else{
                    this.shareClass = "";
                }
            },
            //扫码进入
            handlerRoomHistory : function () {
                let that = this;
                var hash = window.location.hash || "";
                if(hash && hash.includes("#")){
                    let roomIdArgs = hash.split("roomId=");
                    if(roomIdArgs && roomIdArgs.length > 1){
                        this.roomId = parseInt(roomIdArgs[1]);
                        tlLayer.confirm("进入房间"+this.roomId, (index)=>{
                            window.location.hash = "";
                            tlLayer.close(index)
                            that.joinRoom();
                        }, (index)=>{
                            that.roomId = "10086";
                            window.location.hash = "";
                            tlLayer.close(index)
                        })
                    }
                }
            },
            //swiper样式
            reCaculateSwiperSize : function () {
                tlSwiper.autoPreview(".swiperOther");

                //selfvideo css
                let clientWidth = document.body.clientWidth;
                let selfVideoStyleLimit = parseInt((clientWidth - tlSwiper.MIN_WIDTH) / 100);
                let widthPersent = 80-selfVideoStyleLimit * tlSwiper.SLIDE_COUNT;
                if(widthPersent <= 40){
                    widthPersent = 40;
                }
                if(widthPersent >= 70){
                    widthPersent = 70;
                }
                if(clientWidth < tlSwiper.MIN_WIDTH){
                    this.selfVideoStyle = `width:${80}%;`;
                    this.selfVideoStyle += `margin-left:${10}%`;
                    this.autoStyle = "margin-left:0";
                }else{
                    if(this.remoteVideoList.length > 0){
                        this.selfVideoStyle = `width:${67}%;padding: 15px;`;
                        this.autoStyle = "margin-left:0";
                    }else{
                        this.selfVideoStyle = `width:${widthPersent}%;padding: 20px;`;
                        this.selfVideoStyle += `margin-left:${(100-widthPersent)/2}%`;
                        this.autoStyle = "margin-left:16.5%";
                    }
                }
            },
            //屏幕大小变化
            touchResize : function() {
                let that = this;
                setTimeout(()=>{
                    var myEvent = new Event('resize');
                    window.dispatchEvent(myEvent);
                    that.reCaculateSwiperSize();
                },800)
            },
            loadJS : function( url, callback ){
                var script = document.createElement('script'),
                fn = callback || function(){};
                script.type = 'text/javascript';
                //IE
                if(script.readyState){
                    script.onreadystatechange = function(){
                        if( script.readyState == 'loaded' || script.readyState == 'complete' ){
                            script.onreadystatechange = null;
                            fn();
                        }
                    };
                }else{
                    //其他浏览器
                    script.onload = function(){
                        fn();
                    };
                }
                script.src = url;
                document.getElementsByTagName('head')[0].appendChild(script);
            },
        },
        created : function () {
            let that = this;
            if(window.location.hash && window.location.hash.includes("debug")){
                this.loadJS('/static/js/vconsole.min.js',function(){
                    that.loadJS('/static/js/vconsole.js',function(){
                        console.log("load vconsole success")
                    });
                });
            }
        },
        mounted : function () {
            let that = this;
            //屏幕大小变化刷新布局
            window.onresize = this.reCaculateSwiperSize;
            this.reCaculateSwiperSize()
            //定时刷新布局
            // setInterval(()=>{
            //     that.touchResize()
            // },4000)
            
            
            //初始化vue, socket, webrtc, room
            tlVue.init();
        
            tlSocket.init(this.socket,this.socketId)
            tlWebrtc.init(this.config, this.options, null, []);
            tlRoom.init(that.roomId, (success)=>{
                that.createDisabled = !success;
            });
            
            //同步remoteList
            tlVue.Bus.$on("addConnect",(list)=>{
                that.remoteVideoList = list;
            })

            //初始化socket
            this.socketListener();
            
            setTimeout(()=>{
                //监听入口
                that.handlerRoomHistory();
            },200)
        },
        destroyed : function () {

        }
    });
});
