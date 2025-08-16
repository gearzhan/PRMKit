import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Select,
  Upload,
  Table,
  Modal,
  App,
  Typography,
  Space,
  Divider,
  Alert,
  Progress,
  Tag,
  Tooltip,
  Empty,
} from 'antd';
import {
  DownloadOutlined,
  UploadOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import PageLayout from '@/components/PageLayout';
import api from '@/lib/api';
import Papa from 'papaparse';
import type { UploadFile, UploadProps } from 'antd';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

// 数据类型枚举
type DataType = 'employees' | 'projects' | 'timesheets';

// CSV导入日志接口
interface CsvImportLog {
  id: string;
  dataType: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  createdAt: string;
  operator: {
    name: string;
    email: string;
  };
  errors?: CsvImportError[];
}

// CSV导入错误接口
interface CsvImportError {
  id: string;
  rowNumber: number;
  errorMessage: string;
  rowData: string;
}

// 验证结果接口
interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    row: number;
    message: string;
    data: any;
  }>;
  preview: any[];
  totalRows: number;
}

/**
 * 数据管理页面
 * 提供CSV导入导出功能，支持员工、项目、工时数据的批量操作
 */
const DataManagement: React.FC = () => {
  // 获取App实例用于消息提示
  const { message } = App.useApp();
  
  // 状态管理
  const [selectedDataType, setSelectedDataType] = useState<DataType>('employees');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [importLogs, setImportLogs] = useState<CsvImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<CsvImportLog | null>(null);
  const [showLogDetailModal, setShowLogDetailModal] = useState(false);

  // 数据类型选项
  const dataTypeOptions = [
    { value: 'employees', label: 'Employees', icon: '👥' },
    { value: 'projects', label: 'Projects', icon: '📋' },
    { value: 'timesheets', label: 'Timesheets', icon: '⏰' },
  ];

  // 获取导入日志
  const fetchImportLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await api.get('/csv/import/logs');
      setImportLogs(response.data.logs || []);
    } catch (error) {
      console.error('获取导入日志失败:', error);
      message.error('获取导入日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  // 组件挂载时获取日志
  useEffect(() => {
    fetchImportLogs();
  }, []);

  // 处理CSV导出
  const handleExport = async () => {
    try {
      const response = await api.get(`/csv/export/${selectedDataType}`, {
        responseType: 'blob',
      });
      
      // 创建下载链接
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedDataType}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('数据导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('数据导出失败');
    }
  };

  // 处理模板下载
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get(`/csv/template/${selectedDataType}`, {
        responseType: 'blob',
      });
      
      // 创建下载链接
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedDataType}_template.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('模板下载成功');
    } catch (error) {
      console.error('模板下载失败:', error);
      message.error('模板下载失败');
    }
  };

  // 处理文件上传前的验证
  const handleBeforeUpload = (file: File) => {
    const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
    if (!isCSV) {
      message.error('只能上传CSV文件!');
      return false;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超过10MB!');
      return false;
    }
    return false; // 阻止自动上传
  };

  // 处理文件变化
  const handleFileChange: UploadProps['onChange'] = (info) => {
    setFileList(info.fileList.slice(-1)); // 只保留最新的一个文件
    setValidationResult(null); // 清除之前的验证结果
  };

  // 验证CSV文件
  const handleValidateFile = async () => {
    if (fileList.length === 0) {
      message.error('请先选择文件');
      return;
    }

    const file = fileList[0].originFileObj;
    if (!file) {
      message.error('文件读取失败');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataType', selectedDataType);

      const response = await api.post('/csv/import/validate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setValidationResult(response.data);
      setShowValidationModal(true);
    } catch (error: any) {
      console.error('文件验证失败:', error);
      message.error(error.response?.data?.error || '文件验证失败');
    } finally {
      setUploading(false);
    }
  };

  // 执行导入
  const handleImport = async () => {
    if (!validationResult || fileList.length === 0) {
      message.error('请先验证文件');
      return;
    }

    const file = fileList[0].originFileObj;
    if (!file) {
      message.error('文件读取失败');
      return;
    }

    confirm({
      title: '确认导入',
      icon: <ExclamationCircleOutlined />,
      content: `确定要导入 ${validationResult.totalRows} 条${dataTypeOptions.find(opt => opt.value === selectedDataType)?.label}数据吗？`,
      onOk: async () => {
        try {
          setUploading(true);
          const formData = new FormData();
          formData.append('file', file);
          formData.append('dataType', selectedDataType);

          const response = await api.post('/csv/import/execute', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          const result = response.data;
          if (result.status === 'SUCCESS') {
            message.success(`导入成功！共导入 ${result.successRows} 条数据`);
          } else if (result.status === 'PARTIAL') {
            message.warning(`部分导入成功！成功 ${result.successRows} 条，失败 ${result.errorRows} 条`);
          } else {
            message.error(`导入失败！失败 ${result.errorRows} 条`);
          }

          // 清理状态
          setFileList([]);
          setValidationResult(null);
          setShowValidationModal(false);
          
          // 刷新日志
          fetchImportLogs();
        } catch (error: any) {
          console.error('导入失败:', error);
          message.error(error.response?.data?.error || '导入失败');
        } finally {
          setUploading(false);
        }
      },
    });
  };

  // 查看日志详情
  const handleViewLogDetail = async (log: CsvImportLog) => {
    try {
      const response = await api.get(`/csv/import/logs/${log.id}`);
      setSelectedLog(response.data);
      setShowLogDetailModal(true);
    } catch (error) {
      console.error('获取日志详情失败:', error);
      message.error('获取日志详情失败');
    }
  };

  // 验证结果表格列定义
  const validationColumns = [
    {
      title: 'Row',
      dataIndex: 'row',
      key: 'row',
      width: 80,
    },
    {
      title: 'Error Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: 'Data',
      dataIndex: 'data',
      key: 'data',
      ellipsis: true,
      render: (data: any) => JSON.stringify(data),
    },
  ];

  // 导入日志表格列定义
  const logColumns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Data Type',
      dataIndex: 'dataType',
      key: 'dataType',
      width: 120,
      render: (type: string) => {
        const option = dataTypeOptions.find(opt => opt.value === type);
        return option ? `${option.icon} ${option.label}` : type;
      },
    },
    {
      title: 'File Name',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig = {
          SUCCESS: { color: 'green', icon: <CheckCircleOutlined /> },
          PARTIAL: { color: 'orange', icon: <ExclamationCircleOutlined /> },
          FAILED: { color: 'red', icon: <CloseCircleOutlined /> },
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        return (
          <Tag color={config.color} icon={config.icon}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Results',
      key: 'results',
      width: 150,
      render: (record: CsvImportLog) => (
        <Space size="small">
          <Text type="success">{record.successRows}</Text>
          <Text type="secondary">/</Text>
          <Text type="danger">{record.errorRows}</Text>
          <Text type="secondary">({record.totalRows})</Text>
        </Space>
      ),
    },
    {
      title: 'Operator',
      dataIndex: ['operator', 'name'],
      key: 'operator',
      width: 120,
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (record: CsvImportLog) => (
        <Button
          type="link"
          size="small"
          onClick={() => handleViewLogDetail(record)}
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <PageLayout
      title="Data Management"
      description="Import and export CSV data for employees, projects, and timesheets"
      icon={<DatabaseOutlined />}
    >
      {/* 数据类型选择 */}
      <Card className="mb-6">
        <Title level={4} className="mb-4">Select Data Type</Title>
        <Select
          value={selectedDataType}
          onChange={setSelectedDataType}
          style={{ width: 200 }}
          size="large"
        >
          {dataTypeOptions.map(option => (
            <Option key={option.value} value={option.value}>
              <Space>
                <span>{option.icon}</span>
                <span>{option.label}</span>
              </Space>
            </Option>
          ))}
        </Select>
      </Card>

      <Row gutter={[24, 24]}>
        {/* 导出功能 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DownloadOutlined />
                <span>Export Data</span>
              </Space>
            }
            className="h-full"
          >
            <div className="space-y-4">
              <Alert
                message="Export current data"
                description={`Download all ${dataTypeOptions.find(opt => opt.value === selectedDataType)?.label.toLowerCase()} data as CSV file`}
                type="info"
                showIcon
              />
              <Space>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  size="large"
                >
                  Export {dataTypeOptions.find(opt => opt.value === selectedDataType)?.label}
                </Button>
                <Button
                  icon={<FileTextOutlined />}
                  onClick={handleDownloadTemplate}
                  size="large"
                >
                  Download Template
                </Button>
              </Space>
            </div>
          </Card>
        </Col>

        {/* 导入功能 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <UploadOutlined />
                <span>Import Data</span>
              </Space>
            }
            className="h-full"
          >
            <div className="space-y-4">
              <Alert
                message="Import CSV data"
                description="Upload CSV file to import data. File will be validated before import."
                type="warning"
                showIcon
              />
              
              <Upload
                fileList={fileList}
                onChange={handleFileChange}
                beforeUpload={handleBeforeUpload}
                accept=".csv"
                maxCount={1}
              >
                <Button icon={<UploadOutlined />} size="large">
                  Select CSV File
                </Button>
              </Upload>

              <Space>
                <Button
                  type="default"
                  onClick={handleValidateFile}
                  disabled={fileList.length === 0}
                  loading={uploading}
                  size="large"
                >
                  Validate File
                </Button>
                <Button
                  type="primary"
                  onClick={handleImport}
                  disabled={!validationResult || !validationResult.isValid}
                  loading={uploading}
                  size="large"
                >
                  Import Data
                </Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 操作日志 */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>Import Logs</span>
          </Space>
        }
        extra={
          <Button onClick={() => setShowLogsModal(true)}>
            View All Logs
          </Button>
        }
        className="mt-6"
      >
        <Table
          columns={logColumns}
          dataSource={importLogs.slice(0, 5)} // 只显示最近5条
          rowKey="id"
          loading={logsLoading}
          pagination={false}
          locale={{
            emptyText: <Empty description="No import logs yet" />,
          }}
        />
      </Card>

      {/* 验证结果模态框 */}
      <Modal
        title="File Validation Result"
        open={showValidationModal}
        onCancel={() => setShowValidationModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowValidationModal(false)}>
            Cancel
          </Button>,
          <Button
            key="import"
            type="primary"
            disabled={!validationResult?.isValid}
            onClick={handleImport}
            loading={uploading}
          >
            Import Data
          </Button>,
        ]}
        width={800}
      >
        {validationResult && (
          <div className="space-y-4">
            <Alert
              message={validationResult.isValid ? 'Validation Passed' : 'Validation Failed'}
              description={`Total rows: ${validationResult.totalRows}, Errors: ${validationResult.errors.length}`}
              type={validationResult.isValid ? 'success' : 'error'}
              showIcon
            />
            
            {validationResult.errors.length > 0 && (
              <div>
                <Title level={5}>Validation Errors</Title>
                <Table
                  columns={validationColumns}
                  dataSource={validationResult.errors}
                  rowKey={(record, index) => `${record.row}-${index}`}
                  pagination={{ pageSize: 10 }}
                  size="small"
                />
              </div>
            )}
            
            {validationResult.preview.length > 0 && (
              <div>
                <Title level={5}>Data Preview (First 5 rows)</Title>
                <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-auto">
                  <pre className="text-sm">
                    {JSON.stringify(validationResult.preview, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 所有日志模态框 */}
      <Modal
        title="All Import Logs"
        open={showLogsModal}
        onCancel={() => setShowLogsModal(false)}
        footer={null}
        width={1000}
      >
        <Table
          columns={logColumns}
          dataSource={importLogs}
          rowKey="id"
          loading={logsLoading}
          pagination={{ pageSize: 10 }}
        />
      </Modal>

      {/* 日志详情模态框 */}
      <Modal
        title="Import Log Details"
        open={showLogDetailModal}
        onCancel={() => setShowLogDetailModal(false)}
        footer={null}
        width={800}
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text strong>File Name:</Text>
                <div>{selectedLog.fileName}</div>
              </div>
              <div>
                <Text strong>Data Type:</Text>
                <div>{selectedLog.dataType}</div>
              </div>
              <div>
                <Text strong>Total Rows:</Text>
                <div>{selectedLog.totalRows}</div>
              </div>
              <div>
                <Text strong>Success Rows:</Text>
                <div className="text-green-600">{selectedLog.successRows}</div>
              </div>
              <div>
                <Text strong>Error Rows:</Text>
                <div className="text-red-600">{selectedLog.errorRows}</div>
              </div>
              <div>
                <Text strong>Status:</Text>
                <div>
                  <Tag color={selectedLog.status === 'SUCCESS' ? 'green' : selectedLog.status === 'PARTIAL' ? 'orange' : 'red'}>
                    {selectedLog.status}
                  </Tag>
                </div>
              </div>
            </div>
            
            {selectedLog.errors && selectedLog.errors.length > 0 && (
              <div>
                <Title level={5}>Error Details</Title>
                <Table
                  columns={[
                    {
                      title: 'Row',
                      dataIndex: 'rowNumber',
                      key: 'rowNumber',
                      width: 80,
                    },
                    {
                      title: 'Error Message',
                      dataIndex: 'errorMessage',
                      key: 'errorMessage',
                      ellipsis: true,
                    },
                    {
                      title: 'Row Data',
                      dataIndex: 'rowData',
                      key: 'rowData',
                      ellipsis: true,
                    },
                  ]}
                  dataSource={selectedLog.errors}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageLayout>
  );
};

export default DataManagement;