import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { BarChart3 } from 'lucide-react';

const ReportsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Báo cáo thống kê</h1>
        <p className="text-muted-foreground mt-1">
          Xem báo cáo năng lượng, doanh thu và phiên sạc theo thời gian hoặc theo trạm.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Báo cáo thống kê</CardTitle>
          </div>
          <CardDescription>
            Trang báo cáo đang được phát triển. Sẽ có các mục: báo cáo năng lượng, doanh thu, phiên sạc theo ngày/tuần/tháng và theo trạm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Chức năng sẽ được bổ sung trong các bản cập nhật tiếp theo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
