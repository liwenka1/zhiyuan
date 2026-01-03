import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const usecases = [
  {
    title: "技术博客",
    description: "支持代码高亮和数学公式，是技术写作的理想工具"
  },
  {
    title: "学习笔记",
    description: "快速记录学习内容，支持标签分类和全文搜索"
  },
  {
    title: "项目文档",
    description: "编写项目文档和 README，支持多种导出格式"
  },
  {
    title: "日常记录",
    description: "记录生活点滴，简洁的界面让你专注于内容"
  }
];

export function UseCase() {
  return (
    <section id="usecase" className="bg-muted/50 px-4 py-20">
      <div className="container mx-auto">
        <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">使用场景</h2>
        <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center">
          无论你是开发者、学生还是写作爱好者，都能找到适合的使用方式
        </p>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {usecases.map((usecase) => (
            <Card key={usecase.title}>
              <CardHeader>
                <CardTitle>{usecase.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{usecase.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
