import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { CalendarDays } from 'lucide-react';

const MonthlyRevenue = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Doanh thu tháng</h1>
        <p className="text-slate-500 mt-1">Xem báo cáo doanh thu theo tháng</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Doanh thu theo tháng
          </CardTitle>
          <CardDescription>
            Thống kê doanh thu từng tháng, so sánh và xuất báo cáo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Trang đang được phát triển. Biểu đồ và bảng doanh thu tháng sẽ được bổ sung sau khi kết nối API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyRevenue;
