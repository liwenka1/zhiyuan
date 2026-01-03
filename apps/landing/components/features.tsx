import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "实时预览",
    description: "所见即所得的 Markdown 编辑体验，边写边看效果"
  },
  {
    title: "多格式导出",
    description: "支持导出 PDF、HTML、图片等多种格式"
  },
  {
    title: "跨平台支持",
    description: "支持 Windows、macOS、Linux 三大平台"
  },
  {
    title: "本地优先",
    description: "数据存储在本地，保护你的隐私安全"
  },
  {
    title: "快捷操作",
    description: "丰富的快捷键支持，提升写作效率"
  },
  {
    title: "主题切换",
    description: "支持浅色和深色主题，适应不同使用场景"
  }
];

export function Features() {
  return (
    <section id="features" className="px-4 py-20">
      <div className="container mx-auto">
        <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">核心功能</h2>
        <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center">
          为写作者精心打造的功能，让你专注于内容创作
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
