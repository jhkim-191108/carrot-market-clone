// 채팅. 왼쪽 목록 / 오른쪽 대화. 상대 메시지에만 프로필
const chatRoomListEl = document.querySelector("#chatRoomList");
const chatMessageAreaEl = document.querySelector("#chatMessageArea");
const chatSendForm = document.querySelector("#chatSendForm");
const chatInput = document.querySelector("#chatInput");
const chatMenuOverlay = document.querySelector("#chatMenuOverlay");
const chatMoreBtn = document.querySelector("#chatMoreBtn");

// 내 id, 열린 방, 전체 목록, 상대 프로필
let myUserId = null;
let currentRoomId = null;
let allChatList = [];
let partnerProfileImage = "";
let currentProductId = null;
let canChangeStatus = false;
let chatSocket = null;
let joinedRoomId = null;
let pingTimer = null;
let reconnectTimer = null;
let reconnectTries = 0;
let socketReadyOnce = false;

const STATUS_LABEL = {
    on_sale: "거래중",
    reserved: "예약중",
    sold: "거래완료",
};

// JSON 요청용. 로그인은 HttpOnly 쿠키로 서버가 붙임
function authHeaders(extra = {}) {
    return { ...extra };
}

// 목록에 쓸 상대 시간
function formatTime(dateString) {
    if (!dateString) {
        return "";
    }

    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
        return "방금 전";
    }
    if (minutes < 60) {
        return `${minutes}분 전`;
    }
    if (hours < 24) {
        return `${hours}시간 전`;
    }
    if (days < 7) {
        return `${days}일 전`;
    }
    return `${Math.floor(days / 7)}주전`;
}

// 말풍선 옆 시각
function formatClock(dateString) {
    if (!dateString) {
        return "";
    }

    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const period = hours < 12 ? "오전" : "오후";
    const hour12 = hours % 12 || 12;

    return `${period} ${hour12}:${minutes}`;
}

// 가격 포맷
function formatPrice(price) {
    return `${Number(price).toLocaleString("ko-KR")}원`;
}

// 채팅방 한 줄. 클릭하면 그 방 열기
function createChatRoomItem(chat) {
    const li = document.createElement("li");
    li.className = "chat-room-item";
    li.dataset.roomId = chat.id;

    if (Number(chat.id) === Number(currentRoomId)) {
        li.classList.add("is-active");
    }

    const info = document.createElement("div");
    info.className = "chat-room-item-info";

    const top = document.createElement("div");
    top.className = "chat-room-item-top";

    const nickname = document.createElement("span");
    nickname.className = "chat-room-item-id";
    nickname.textContent = chat.nickname;

    const meta = document.createElement("span");
    meta.className = "chat-room-item-meta";
    meta.textContent = `${chat.location} · ${chat.time}`;

    top.append(nickname, meta);

    const preview = document.createElement("p");
    preview.className = "chat-room-item-preview";
    preview.textContent = chat.lastMessage;

    info.append(top, preview);

    const thumb = document.createElement("div");
    thumb.className = "chat-room-item-thumb";
    if (chat.thumbnail) {
        thumb.style.backgroundImage = `url("${chat.thumbnail}")`;
    }

    li.append(info);

    if (chat.unreadCount > 0) {
        const badge = document.createElement("span");
        badge.className = "chat-unread-badge";
        badge.textContent = chat.unreadCount;
        li.append(badge);
    }

    li.append(thumb);
    li.addEventListener("click", () => openChatRoom(chat.id));
    return li;
}

// 채팅 목록 그리기. 안읽음만 보기면 필터
function renderChatList() {
    const unreadOnly = document.querySelector("#unreadToggle").checked;
    const visibleList = unreadOnly
        ? allChatList.filter((chat) => chat.unreadCount > 0)
        : allChatList;

    chatRoomListEl.replaceChildren();
    visibleList.forEach((chat) => {
        chatRoomListEl.append(createChatRoomItem(chat));
    });
}

// 프로필 이미지 있는지
function hasProfileImage(url) {
    return Boolean(url) && url !== "string";
}

// 닉네임, 매너온도, 상품 정보, 상대 프로필 URL 채움
function renderRoomHeader(room) {
    document.querySelector(".chat-room-header-id").textContent = room.partner.nickname;
    document.querySelector(".chat-room-header-location").textContent = room.product.location || "";
    document.querySelector(".chat-product-title").textContent = room.product.title;
    document.querySelector(".chat-product-price").textContent = formatPrice(room.product.price);
    document.querySelector(".chat-product-status").textContent = room.product.statusLabel || "";

    currentProductId = room.product?.id || room.productId || null;
    const sellerId = room.sellerId ?? room.product?.seller?.id;
    canChangeStatus = room.myRole === "seller" || (myUserId != null && sellerId != null && String(sellerId) === String(myUserId));

    const statusBtn = document.querySelector("#chatProductStatus");
    statusBtn.disabled = !canChangeStatus;
    statusBtn.classList.toggle("is-editable", canChangeStatus);
    closeStatusMenu();

    const productLink = document.querySelector("#chatProductLink");
    if (room.product?.id) {
        productLink.href = `./trade-post.html?id=${room.product.id}`;
    } else {
        productLink.removeAttribute("href");
    }

    const mannerTemp = room.product.seller?.mannerTemp;
    document.querySelector(".chat-manner-temp").textContent = mannerTemp ? `${mannerTemp}°C` : "";

    const thumb = document.querySelector(".chat-product-thumb");
    if (hasProfileImage(room.product.thumbnail)) {
        thumb.style.backgroundImage = `url("${room.product.thumbnail}")`;
    } else {
        thumb.style.backgroundImage = "";
    }

    partnerProfileImage = room.partner.profileImage || "";
}

// 상대 동그란 프로필. 이어서 온 메시지는 자리만 비움
function createPartnerAvatar(grouped) {
    const avatar = document.createElement("div");
    avatar.className = "chat-message-avatar";

    if (grouped) {
        avatar.classList.add("is-hidden");
        return avatar;
    }

    if (hasProfileImage(partnerProfileImage)) {
        avatar.style.backgroundImage = `url("${partnerProfileImage}")`;
        return avatar;
    }

    const img = document.createElement("img");
    img.src = "../images/profile.svg";
    img.alt = "";
    avatar.append(img);
    return avatar;
}

// 말풍선. 내 메시지는 오른쪽, 상대는 왼쪽+프로필
function createMessageEl(message, grouped = false) {
    const isMine = Number(message.senderId) === Number(myUserId);
    const wrap = document.createElement("div");
    wrap.className = isMine ? "chat-message chat-message-sent" : "chat-message chat-message-received";
    if (message.id != null) {
        wrap.dataset.messageId = String(message.id);
    }

    if (grouped) {
        wrap.classList.add("is-grouped");
    }

    const bubble = document.createElement("p");
    bubble.className = "chat-message-bubble";
    bubble.textContent = message.content;

    const time = document.createElement("span");
    time.className = "chat-message-time";
    time.textContent = formatClock(message.createdAt);

    if (isMine) {
        wrap.append(time, bubble);
        return wrap;
    }

    wrap.append(createPartnerAvatar(grouped), bubble, time);
    return wrap;
}

// 메시지 목록 그리기
function renderMessages(messages) {
    chatMessageAreaEl.replaceChildren();
    messages.forEach((message, index) => {
        const prev = messages[index - 1];
        const grouped = Boolean(prev) && Number(prev.senderId) === Number(message.senderId);
        chatMessageAreaEl.append(createMessageEl(message, grouped));
    });
    chatMessageAreaEl.scrollTop = chatMessageAreaEl.scrollHeight;
}

// 내 닉네임을 목록 위에 표시하려고 조회
async function fetchMe() {
    const response = await fetch("/api/auth/me", {
        headers: authHeaders(),
    });

    if (!response.ok) {
        return;
    }

    const data = await response.json();
    myUserId = data.user.id;
    document.querySelector(".chat-info-id").textContent = data.user.nickname;
}

// 채팅 목록 조회
async function fetchChatList() {
    const response = await fetch("/api/chats", {
        method: "GET",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error(`채팅 목록 요청 실패: ${response.status}`);
    }

    const data = await response.json();

    allChatList = data.items.map((room) => ({
        id: room.id,
        nickname: room.partner.nickname,
        location: room.product.location,
        time: formatTime(room.lastMessageAt),
        lastMessage: room.lastMessage ? room.lastMessage.content : "",
        thumbnail: room.product.thumbnail,
        unreadCount: room.unreadCount || 0,
        room,
    }));

    renderChatList();
}

function chatSocketUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws`;
}

function wsSend(payload) {
    if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
        return false;
    }

    chatSocket.send(JSON.stringify(payload));
    return true;
}

function joinRoomSocket(roomId) {
    if (!roomId) {
        return;
    }

    const nextId = Number(roomId);

    if (joinedRoomId && Number(joinedRoomId) !== nextId) {
        wsSend({ type: "leave", roomId: Number(joinedRoomId) });
    }

    joinedRoomId = nextId;
    wsSend({ type: "join", roomId: nextId });
    wsSend({ type: "read", roomId: nextId });
}

function leaveRoomSocket(roomId) {
    if (!roomId) {
        return;
    }

    wsSend({ type: "leave", roomId: Number(roomId) });

    if (Number(joinedRoomId) === Number(roomId)) {
        joinedRoomId = null;
    }
}

function updateListPreview(roomId, message, increaseUnread) {
    const cached = allChatList.find((chat) => Number(chat.id) === Number(roomId));
    if (!cached || !message) {
        return;
    }

    cached.lastMessage = message.content || cached.lastMessage;
    cached.time = formatTime(message.createdAt);
    cached.unreadCount = increaseUnread ? (cached.unreadCount || 0) + 1 : 0;
    renderChatList();
}

function appendLiveMessage(message) {
    if (!message) {
        return;
    }

    if (message.id != null) {
        const exists = chatMessageAreaEl.querySelector(`[data-message-id="${message.id}"]`);
        if (exists) {
            return;
        }
    }

    const last = chatMessageAreaEl.lastElementChild;
    const grouped = Boolean(last) && (
        Number(message.senderId) === Number(myUserId)
            ? last.classList.contains("chat-message-sent")
            : last.classList.contains("chat-message-received")
    );

    chatMessageAreaEl.append(createMessageEl(message, grouped));
    chatMessageAreaEl.scrollTop = chatMessageAreaEl.scrollHeight;
}

function handleSocketEvent(data) {
    if (!data || !data.type) {
        return;
    }

    if (data.type === "message") {
        const roomId = data.roomId ?? data.message?.roomId ?? joinedRoomId;
        const isOpen = Number(roomId) === Number(currentRoomId);

        if (isOpen) {
            appendLiveMessage(data.message);
            updateListPreview(roomId, data.message, false);
            if (Number(data.message?.senderId) !== Number(myUserId)) {
                wsSend({ type: "read", roomId: Number(roomId) });
            }
            return;
        }

        updateListPreview(roomId, data.message, Number(data.message?.senderId) !== Number(myUserId));
        return;
    }

    if (data.type === "notification") {
        const roomId = data.roomId ?? data.message?.roomId;
        const isOpen = Number(roomId) === Number(currentRoomId);
        updateListPreview(roomId, data.message, !isOpen && Number(data.message?.senderId) !== Number(myUserId));
        return;
    }

    if (data.type === "error") {
        console.error(data.message || data.code);
    }
}

function stopPing() {
    if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
    }
}

function connectChatSocket() {
    if (!myUserId) {
        return;
    }

    if (chatSocket && (chatSocket.readyState === WebSocket.OPEN || chatSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    chatSocket = new WebSocket(chatSocketUrl());

    chatSocket.addEventListener("open", () => {
        reconnectTries = 0;
        socketReadyOnce = true;
        stopPing();
        pingTimer = setInterval(() => {
            wsSend({ type: "ping" });
        }, 20000);

        if (currentRoomId) {
            joinRoomSocket(currentRoomId);
        }
    });

    chatSocket.addEventListener("message", (event) => {
        try {
            handleSocketEvent(JSON.parse(event.data));
        } catch (error) {
            console.error(error);
        }
    });

    chatSocket.addEventListener("close", () => {
        stopPing();
        joinedRoomId = null;
        chatSocket = null;

        if (reconnectTimer) {
            return;
        }

        reconnectTries += 1;
        if (!socketReadyOnce && reconnectTries > 3) {
            return;
        }

        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectChatSocket();
        }, 3000);
    });

    chatSocket.addEventListener("error", () => {
        if (chatSocket) {
            chatSocket.close();
        }
    });
}

// 방 헤더는 목록 응답을 재사용하고, 메시지 API만 추가로 호출
async function openChatRoom(roomId) {
    currentRoomId = roomId;

    const cached = allChatList.find((chat) => Number(chat.id) === Number(roomId));
    const room = cached?.room;

    if (room) {
        renderRoomHeader(room);
    }

    const messagesResponse = await fetch(`/api/chats/${roomId}/messages`, {
        headers: authHeaders(),
    });

    if (!messagesResponse.ok) {
        const data = await messagesResponse.json();
        await appAlert(data.message || "채팅방을 불러오지 못했습니다.");
        return;
    }

    const messageData = await messagesResponse.json();
    renderMessages(messageData.items);

    if (cached) {
        cached.unreadCount = 0;
    }

    document.querySelectorAll(".chat-room-item").forEach((item) => {
        item.classList.toggle("is-active", Number(item.dataset.roomId) === Number(roomId));
    });

    // 모바일에서 대화 화면 열기
    document.querySelector(".chat-content").classList.add("is-room-open");
    renderChatList();
    joinRoomSocket(roomId);
}

// 채팅방 화면 비우기
function clearRoomView() {
    currentRoomId = null;
    partnerProfileImage = "";
    document.querySelector(".chat-room-header-id").textContent = "";
    document.querySelector(".chat-room-header-location").textContent = "";
    document.querySelector(".chat-manner-temp").textContent = "";
    document.querySelector(".chat-product-title").textContent = "";
    document.querySelector(".chat-product-price").textContent = "";
    document.querySelector(".chat-product-status").textContent = "";
    document.querySelector(".chat-product-thumb").style.backgroundImage = "";
    document.querySelector("#chatProductLink").removeAttribute("href");
    currentProductId = null;
    canChangeStatus = false;
    closeStatusMenu();
    chatMessageAreaEl.replaceChildren();
    closeChatMenu();
}

// DELETE로 방 나간 뒤 목록으로
async function leaveChatRoom() {
    if (!currentRoomId) {
        await appAlert("나갈 채팅방을 먼저 선택해주세요.");
        return;
    }

    const confirmed = await appConfirm("채팅방에서 나가시겠습니까?");
    if (!confirmed) {
        return;
    }

    const roomId = currentRoomId;
    leaveRoomSocket(roomId);
    const response = await fetch(`/api/chats/${roomId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
        joinRoomSocket(roomId);
        await appAlert(data.message || "채팅방 나가기에 실패했습니다.");
        return;
    }

    clearRoomView();
    // 모바일에서 목록으로
    document.querySelector(".chat-content").classList.remove("is-room-open");
    allChatList = allChatList.filter((chat) => Number(chat.id) !== Number(roomId));
    renderChatList();
}

// 메시지 보내기
async function sendMessage(content) {
    if (!currentRoomId) {
        await appAlert("채팅방을 먼저 선택해주세요.");
        return;
    }

    const response = await fetch(`/api/chats/${currentRoomId}/messages`, {
        method: "POST",
        headers: authHeaders({
            "Content-Type": "application/json",
        }),
        body: JSON.stringify({ content }),
    });

    const data = await response.json();

    if (!response.ok) {
        await appAlert(data.message || "메시지를 보내지 못했습니다.");
        return;
    }

    appendLiveMessage(data.message);

    const cached = allChatList.find((chat) => Number(chat.id) === Number(currentRoomId));
    if (cached) {
        cached.lastMessage = data.message.content;
        cached.time = formatTime(data.message.createdAt);
        cached.unreadCount = 0;
        renderChatList();
    }
}

// 메시지 전송
chatSendForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const content = chatInput.value.trim();
    if (!content) {
        return;
    }

    chatInput.value = "";

    try {
        await sendMessage(content);
    } catch (error) {
        console.error(error);
    }
});

// ... 누르면 나가기만 있는 하단 메뉴
function openChatMenu() {
    chatMenuOverlay.classList.add("is-open");
    chatMoreBtn.setAttribute("aria-expanded", "true");
}

function closeChatMenu() {
    chatMenuOverlay.classList.remove("is-open");
    chatMoreBtn.setAttribute("aria-expanded", "false");
}

chatMoreBtn.addEventListener("click", openChatMenu);

document.querySelector("#chatMenuClose").addEventListener("click", closeChatMenu);

chatMenuOverlay.addEventListener("click", (event) => {
    if (event.target === chatMenuOverlay) {
        closeChatMenu();
    }
});

// 채팅방 나가기
document.querySelector("#chatLeaveBtn").addEventListener("click", async () => {
    closeChatMenu();
    try {
        await leaveChatRoom();
    } catch (error) {
        console.error(error);
    }
});

// 목록으로
document.querySelector("#chatBackBtn").addEventListener("click", () => {
    closeChatMenu();
    leaveRoomSocket(currentRoomId);
    document.querySelector(".chat-content").classList.remove("is-room-open");
});

// 읽지 않은 채팅
document.querySelector("#unreadToggle").addEventListener("change", () => {
    renderChatList();
});

function closeStatusMenu() {
    const menu = document.querySelector("#chatStatusMenu");
    if (menu) {
        menu.hidden = true;
    }
}

// 내 상품이면 PATCH /api/products/:id/status
async function changeProductStatus(status) {
    if (!currentProductId) {
        await appAlert("상품 정보를 찾을 수 없습니다.");
        return;
    }

    if (!canChangeStatus) {
        await appAlert("판매자만 거래 상태를 바꿀 수 있습니다.");
        return;
    }

    const response = await fetch(`/api/products/${currentProductId}/status`, {
        method: "PATCH",
        headers: authHeaders({
            "Content-Type": "application/json",
        }),
        body: JSON.stringify({ status }),
    });

    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        console.error(error);
    }

    if (!response.ok) {
        await appAlert(data.message || data.error || "거래 상태를 바꾸지 못했습니다.");
        return;
    }

    const label = data.product?.statusLabel || STATUS_LABEL[status];
    document.querySelector("#chatProductStatus").textContent = label;

    const cached = allChatList.find((chat) => Number(chat.id) === Number(currentRoomId));
    if (cached?.room?.product) {
        cached.room.product.status = data.product?.status || status;
        cached.room.product.statusLabel = label;
    }
}

document.querySelector("#chatProductStatus").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!canChangeStatus) {
        return;
    }

    const menu = document.querySelector("#chatStatusMenu");
    menu.hidden = !menu.hidden;
});

document.querySelector("#chatStatusMenu").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    closeStatusMenu();

    try {
        await changeProductStatus(button.dataset.status);
    } catch (error) {
        console.error(error);
        await appAlert("거래 상태를 바꾸지 못했습니다.");
    }
});

document.addEventListener("click", (event) => {
    const wrap = document.querySelector(".chat-product-status-wrap");
    if (!wrap || wrap.contains(event.target)) {
        return;
    }
    closeStatusMenu();
});

// 시작
async function initChat() {
    try {
        await fetchMe();
        await fetchChatList();
        connectChatSocket();

        // 주소에 ?id= 있으면 그 방 열기
        const roomId = new URLSearchParams(window.location.search).get("id");
        if (roomId) {
            await openChatRoom(roomId);
        }
    } catch (error) {
        console.error(error);
    }
}

initChat();
