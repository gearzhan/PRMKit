import React from 'react';
import { Typography } from 'antd';
import Navigation from '@/components/Navigation';

const { Title } = Typography;

// 页面布局组件的属性接口
interface PageLayoutProps {
  // 页面标题
  title: string;
  // 页面描述（可选）
  description?: string;
  // 页面标题图标（可选）
  icon?: React.ReactNode;
  // 页面内容
  children: React.ReactNode;
  // 是否显示导航栏（默认显示）
  showNavigation?: boolean;
  // 自定义页面背景色（默认为灰色背景）
  backgroundColor?: string;
  // 自定义容器样式类名
  containerClassName?: string;
  // 标题级别（默认为2）
  titleLevel?: 1 | 2 | 3 | 4 | 5;
  // 额外的头部内容（在标题右侧显示）
  extra?: React.ReactNode;
}

/**
 * 统一的页面布局组件
 * 提供一致的导航栏位置、页面标题样式、背景色和容器样式
 */
const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  description,
  icon,
  children,
  showNavigation = true,
  backgroundColor = 'bg-gray-50',
  containerClassName = '',
  titleLevel = 2,
  extra,
}) => {
  return (
    <div className={`min-h-screen ${backgroundColor}`}>
      {/* 统一的导航栏 - 固定在页面顶部 */}
      {showNavigation && (
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-end items-center h-16">
              <Navigation />
            </div>
          </div>
        </div>
      )}
      
      {/* 页面内容容器 */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${containerClassName}`}>
        {/* 统一的页面标题区域 */}
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <Title level={titleLevel} className="!mb-2 flex items-center gap-2">
                {icon && <span className="text-blue-500">{icon}</span>}
                {title}
              </Title>
              {description && (
                <p className="text-gray-600 text-base leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {/* 额外内容区域 */}
            {extra && (
              <div className="ml-6 flex-shrink-0">
                {extra}
              </div>
            )}
          </div>
        </div>
        
        {/* 页面主要内容 */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageLayout;