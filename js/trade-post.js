// 상품 상세. 본인 글이면 수정/삭제, 채팅하기는 방 만들고 이동
const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

let sellerId = null;
let currentUserId = null;

// GET /api/products/:id 로 제목, 가격, 본문 채움
async function getProduct() {
  try {
    const res = await fetch(`/api/products/${productId}`);

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "상품 정보를 가져오지 못했습니다.");
    }

    const product = data.product || data;

    sellerId = product.seller?.id;

    document.querySelector(".post-title").textContent = product.title;

    document.querySelector(".post-price").textContent =
      product.price.toLocaleString() + "원";

    document.querySelector(".view-num").textContent = product.viewCount;
    document.querySelector(".chat-num").textContent = product.chatCount;

    const postText = document.querySelector(".post-text");
    postText.replaceChildren();
    String(product.description || "").split("\n").forEach((line, index, lines) => {
      postText.append(document.createTextNode(line));
      if (index < lines.length - 1) {
        postText.append(document.createElement("br"));
      }
    });

    document.querySelector(".place-text").textContent = product.location;

    document.querySelector(".post-id").textContent =
      product.seller.nickname;

    document.querySelector(".post-loc").textContent =
      product.location;

    const imgEl = document.querySelector(".img-box img");

    if (product.thumbnail?.startsWith("http")) {
      imgEl.src = product.thumbnail;
      imgEl.alt = product.title;
    } else {
      imgEl.remove();
    }

    checkOwner();

  } catch (err) {
    console.error("상품 정보를 못 가져왔어요:", err);
  }
}


// 로그인한 사람이 판매자면 수정/삭제 버튼 보여줌
async function checkOwner() {
  try {
    if (!sellerId) {
      document.querySelector(".post-btn-box").hidden = true;
      return;
    }

    const res = await fetch("/api/auth/me");

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.message || "사용자 정보를 가져오지 못했습니다."
      );
    }

    currentUserId = data.user?.id;

    document.querySelector(".post-btn-box").hidden =
      String(currentUserId) !== String(sellerId);

  } catch (err) {
    console.error("사용자 확인 실패:", err);
    document.querySelector(".post-btn-box").hidden = true;
  }
}


// 뒤로가기
document.querySelector(".btn-back").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.location.href = "trade.html";
  }
});


// POST /api/chats 후 chat.html?id= 로 이동. 비로그인이면 로그인 페이지로
document.querySelector(".btn-chat").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: Number(productId),
      }),
    });

    const data = await res.json();

    if (res.status === 401) {
      await appAlert("로그인이 필요합니다.");
      window.location.href = "./login.html";
      return;
    }

    if (!res.ok) {
      throw new Error(
        data.message || "채팅방을 만들지 못했습니다."
      );
    }

    const chatId =
      data.room?.id ||
      data.chat?.id ||
      data.id;

    if (!chatId) {
      throw new Error("채팅방 ID를 찾을 수 없습니다.");
    }

    window.location.href = `chat.html?id=${chatId}`;

  } catch (err) {
    console.error("채팅방을 못 만들었어요:", err);
  }
});


// DELETE /api/products/:id 후 목록으로
document.querySelector(".btn-delete").addEventListener("click", async () => {
  if (!(await appConfirm("이 게시글을 삭제할까요?"))) {
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (!res.ok) {
      await appAlert(data.message || "삭제에 실패했습니다.");
      return;
    }

    await appAlert(data.message || "삭제되었습니다.");
    window.location.href = "trade.html";

  } catch (err) {
    console.error("상품 삭제 실패:", err);
  }
});


// 본인 글만 write.html?id= 로 보냄
document.querySelector(".btn-edit").addEventListener("click", async () => {
  if (!currentUserId || String(currentUserId) !== String(sellerId)) {
    await appAlert("본인 게시글만 수정할 수 있습니다.");
    return;
  }

  window.location.href = `write.html?id=${productId}`;
});


// 상품 정보 불러오기
getProduct();