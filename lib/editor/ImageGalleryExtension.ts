import { Node, mergeAttributes } from "@tiptap/core";

export const ImageGallery = Node.create({
  name: "imageGallery",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      images: {
        default: [] as string[],
        parseHTML: (element) => {
          const raw = element.getAttribute("data-images");
          try {
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-images": JSON.stringify(attributes.images ?? []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.blog-gallery" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const images: string[] = node.attrs.images ?? [];
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "blog-gallery" }),
      ...images.map((src) => ["img", { src, class: "blog-gallery-item", loading: "lazy", alt: "" }]),
    ];
  },
});
