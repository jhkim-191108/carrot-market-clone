let currentPage = 1;
let isLoading = false;
let hasNext = true;

const listEl = document.querySelector(".popular-list");

async function loadProducts() {
  if (isLoading || !hasNext) return;

  isLoading = true;

  try {
    const response = await fetch(`/api/products?sort=views&page=${currentPage}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "상품 목록을 불러오지 못했습니다.");
    }

    data.items.forEach((product) => {
      const li = document.createElement("li");
      li.className = "popular-item";

      const link = document.createElement("a");
      link.href = `trade-post.html?id=${encodeURIComponent(product.id)}`;

      const thumb = document.createElement("div");
      thumb.className = "popular-thumb";
      if (product.thumbnail?.startsWith("http")) {
        const img = document.createElement("img");
        img.src = product.thumbnail;
        img.alt = product.title || "";
        thumb.append(img);
      }

      const textBox = document.createElement("div");
      textBox.className = "popular-text-box";

      const name = document.createElement("p");
      name.className = "popular-name";
      name.textContent = product.title || "";

      const price = document.createElement("strong");
      price.className = "popular-price";
      price.textContent = `${Number(product.price).toLocaleString()}원`;

      const location = document.createElement("span");
      location.className = "popular-location";
      location.textContent = product.location || "";

      const info = document.createElement("div");
      info.className = "popular-info";

      const viewLabel = document.createElement("span");
      viewLabel.textContent = "조회";
      const viewNum = document.createElement("span");
      viewNum.className = "num";
      viewNum.textContent = String(product.viewCount ?? 0);
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.textContent = "·";
      const chatLabel = document.createElement("span");
      chatLabel.textContent = "채팅";
      const chatNum = document.createElement("span");
      chatNum.className = "num";
      chatNum.textContent = String(product.chatCount ?? 0);

      info.append(viewLabel, viewNum, dot, chatLabel, chatNum);
      textBox.append(name, price, location, info);
      link.append(thumb, textBox);
      li.append(link);
      listEl.append(li);
    });

    hasNext = data.hasNext;
    currentPage++;
  } catch (error) {
    console.error("상품 목록을 못 가져왔어요:", error);
  } finally {
    isLoading = false;
  }
}

loadProducts();

window.addEventListener("scroll", () => {
  const scrolledToBottom =
    window.innerHeight + window.scrollY >=
    document.body.offsetHeight - 300;

  if (scrolledToBottom) {
    loadProducts();
  }
});
