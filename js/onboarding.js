// =========================================================
// 인기매물 목록 / 더 보기
// - 홈 화면의 "인기매물" 그리드를 서버 데이터로 채우고
// - "더 보기" 클릭 시 전체 목록 페이지(trade.html)로 이동시킴
// =========================================================

const listEl = document.querySelector(".pop-grid");       // 카드들이 들어갈 grid 컨테이너
const moreBtn = document.querySelector(".pop-items-more"); // "더 보기" 버튼

// 인기매물 상위 8개 가져오기
async function loadPopularProducts() {
    try {
        // 조회수 많은 순으로 8개
        const response = await fetch("/api/products?sort=views&page=1&limit=8");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "상품 목록을 불러오지 못했습니다."
            );
        }

        const products = data.items || [];

        // 기존 예시 카드 삭제 (HTML에 미리 넣어둔 더미 카드가 있다면 여기서 지워짐)
        listEl.replaceChildren();

        products.forEach((product) => {
            const li = document.createElement("li");
            li.className = "item-card";

            const link = document.createElement("a");
            link.href = `./trade-post.html?id=${encodeURIComponent(product.id)}`;

            const thumb = document.createElement("div");
            thumb.className = "card-thumb";
            if (product.thumbnail?.startsWith("http")) {
                const img = document.createElement("img");
                img.src = product.thumbnail;
                img.alt = product.title || "";
                thumb.append(img);
            }

            const textBox = document.createElement("div");
            textBox.className = "card-text";

            const name = document.createElement("p");
            name.className = "card-name";
            name.textContent = product.title || "";

            const price = document.createElement("p");
            price.className = "card-price";
            price.textContent = `${Number(product.price).toLocaleString()}원`;

            const location = document.createElement("p");
            location.className = "card-location";
            location.textContent = product.location || "";

            const meta = document.createElement("p");
            meta.className = "card-meta";
            meta.textContent = `조회 ${product.viewCount} · 채팅 ${product.chatCount}`;

            textBox.append(name, price, location, meta);
            link.append(thumb, textBox);
            li.append(link);
            listEl.append(li);
        });
    } catch (error) {
        // 네트워크 오류 등으로 못 불러와도 페이지 자체는 그대로 유지 (콘솔에만 기록)
        console.error("인기매물을 못 가져왔어요:", error);
    }
}


// 인기매물 더 보기
// moreBtn이 없는 페이지에서도 에러 안 나도록 존재 여부 확인 후 이벤트 등록
if (moreBtn) {
    moreBtn.addEventListener("click", () => {
        window.location.href = "./trade.html";
    });
}


// 페이지가 로드되면 인기매물 가져오기
loadPopularProducts();