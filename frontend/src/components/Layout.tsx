import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Tooltip } from 'antd';
import {
  AppstoreOutlined,
  SearchOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

const Layout: React.FC = () => {
  const items = [
    { to: '/', label: '招聘看板', icon: <AppstoreOutlined />, end: true },
    { to: '/search', label: '人才检索', icon: <SearchOutlined />, end: false },
    { to: '/analytics', label: '渠道分析', icon: <BarChartOutlined />, end: false },
  ];

  return (
    <div className="app-layout">
      <nav className="module-rail">
        <div className="module-rail-logo">招</div>
        {items.map((item) => (
          <Tooltip key={item.to} title={item.label} placement="right">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                'module-rail-item' + (isActive ? ' active' : '')
              }
            >
              {item.icon}
            </NavLink>
          </Tooltip>
        ))}
      </nav>
      <main className="module-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
