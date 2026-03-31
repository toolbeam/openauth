function escapeHtml(input: string) {
	return input
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
}

export function mermaid() {
	return (tree: any) => {
		const walk = (node: any) => {
			if (!node?.children || !Array.isArray(node.children)) return
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i]
				if (child?.type === "code" && child?.lang === "mermaid") {
					node.children[i] = {
						type: "html",
						value: `<pre class="mermaid">${escapeHtml(child.value ?? "")}</pre>`,
					}
					continue
				}
				walk(child)
			}
		}
		walk(tree)
	}
}
