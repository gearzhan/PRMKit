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
  Radio,
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

// 数据类型枚举
type DataType = 'EMPLOYEE' | 'PROJECT' | 'TIMESHEET' | 'STAGE';

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
  duplicates?: Array<{
    row: number;
    field: string;
    value: string;
    existingData: any;
    newData: any;
  }>;
}

/**
 * 数据管理页面
 * 提供CSV导入导出功能，支持员工、项目、工时数据的批量操作
 */
const DataManagement: React.FC = () => {
  // 获取App实例用于消息提示和模态框
  const { message, modal } = App.useApp();
  
  // 状态管理
  const [selectedDataType, setSelectedDataType] = useState<DataType>('EMPLOYEE');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [importLogs, setImportLogs] = useState<CsvImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<CsvImportLog | null>(null);
  const [showLogDetailModal, setShowLogDetailModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any[]>([]);
  const [duplicateDecisions, setDuplicateDecisions] = useState<{[key: string]: 'replace' | 'skip'}>({});

  // 数据类型选项
  const dataTypeOptions = [
    { value: 'EMPLOYEE', label: 'Employees', icon: '👥' },
    { value: 'PROJECT', label: 'Projects', icon: '📋' },
    { value: 'TIMESHEET', label: 'Timesheets', icon: '⏰' },
    { value: 'STAGE', label: 'Stages', icon: '🎯' },
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

  // 数据类型到路径的映射
  const getDataTypePath = (dataType: DataType): string => {
    const pathMap: Record<DataType, string> = {
      'EMPLOYEE': 'employees',
      'PROJECT': 'projects',
      'TIMESHEET': 'timesheets',
      'STAGE': 'stages'
    };
    return pathMap[dataType];
  };

  // 处理CSV导出
  const handleExport = async () => {
    try {
      const dataTypePath = getDataTypePath(selectedDataType);
      const response = await api.get(`/csv/export/${dataTypePath}`, {
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
      const dataTypePath = getDataTypePath(selectedDataType);
      const response = await api.get(`/csv/template/${dataTypePath}`, {
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
      formData.append('csvFile', file);
      formData.append('dataType', selectedDataType);

      const response = await api.post('/csv/import/validate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // 将嵌套的错误结构转换为扁平化格式
      const flattenedErrors = response.data.errors.flatMap((errorGroup: any) => 
        errorGroup.errors.map((error: any) => ({
          row: errorGroup.rowNumber,
          message: error.message,
          data: error.value
        }))
      );

      // 根据errorRows数量设置isValid属性
      const validationData = {
        ...response.data,
        errors: flattenedErrors,
        isValid: response.data.errorRows === 0,
        duplicates: response.data.duplicates || []
      };
      
      setValidationResult(validationData);
      
      // 如果有重复数据，显示重复数据处理模态框
      if (validationData.duplicates && validationData.duplicates.length > 0) {
        setDuplicateData(validationData.duplicates);
        setShowDuplicateModal(true);
      } else {
        setShowValidationModal(true);
      }
    } catch (error: any) {
      console.error('文件验证失败:', error);
      message.error(error.response?.data?.error || '文件验证失败');
    } finally {
      setUploading(false);
    }
  };

  // 处理重复数据决策
  const handleDuplicateDecision = (duplicateKey: string, decision: 'replace' | 'skip') => {
    setDuplicateDecisions(prev => ({
      ...prev,
      [duplicateKey]: decision
    }));
  };

  // 批量替换所有重复数据
  const handleReplaceAll = () => {
    const allDecisions: { [key: string]: 'replace' | 'skip' } = {};
    duplicateData.forEach((duplicate, index) => {
      const duplicateKey = `${duplicate.row || 'unknown'}-${duplicate.field || 'field'}-${index}`;
      allDecisions[duplicateKey] = 'replace';
    });
    setDuplicateDecisions(allDecisions);
    message.success(`已将所有 ${duplicateData.length} 个重复项设置为替换`);
  };

  // 批量跳过所有重复数据
  const handleSkipAll = () => {
    const allDecisions: { [key: string]: 'replace' | 'skip' } = {};
    duplicateData.forEach((duplicate, index) => {
      const duplicateKey = `${duplicate.row || 'unknown'}-${duplicate.field || 'field'}-${index}`;
      allDecisions[duplicateKey] = 'skip';
    });
    setDuplicateDecisions(allDecisions);
    message.success(`已将所有 ${duplicateData.length} 个重复项设置为跳过`);
  };

  // 确认重复数据处理并继续导入
  const handleConfirmDuplicates = async () => {
    if (!validationResult || fileList.length === 0) {
      message.error('请先验证文件');
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
      formData.append('csvFile', file);
      formData.append('dataType', selectedDataType);
      
      // 添加重复数据决策到请求中
      if (Object.keys(duplicateDecisions).length > 0) {
        formData.append('duplicateDecisions', JSON.stringify(duplicateDecisions));
      }

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
      setShowDuplicateModal(false);
      setDuplicateData([]);
      setDuplicateDecisions({});
      
      // 刷新日志
      fetchImportLogs();
    } catch (error: any) {
      console.error('导入失败:', error);
      let errorMessage = '导入失败';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = `导入失败: ${error.message}`;
      }
      
      // 如果是网络错误或服务器错误，提供更友好的提示
      if (error.code === 'NETWORK_ERROR' || error.response?.status >= 500) {
        errorMessage = '服务器连接失败，请稍后重试';
      } else if (error.response?.status === 413) {
        errorMessage = '文件过大，请选择较小的文件';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.error || '请求参数错误，请检查文件格式';
      }
      
      message.error(errorMessage);
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

    modal.confirm({
      title: '确认导入',
      icon: <ExclamationCircleOutlined />,
      content: `确定要导入 ${validationResult.totalRows} 条${dataTypeOptions.find(opt => opt.value === selectedDataType)?.label}数据吗？`,
      onOk: async () => {
        try {
          setUploading(true);
          const formData = new FormData();
          formData.append('csvFile', file);
          formData.append('dataType', selectedDataType);
          
          // 如果有重复数据决策，添加到请求中
          if (Object.keys(duplicateDecisions).length > 0) {
            formData.append('duplicateDecisions', JSON.stringify(duplicateDecisions));
          }

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
          setShowDuplicateModal(false);
          setDuplicateData([]);
          setDuplicateDecisions({});
          
          // 刷新日志
          fetchImportLogs();
        } catch (error: any) {
          console.error('导入失败:', error);
          let errorMessage = '导入失败';
          
          if (error.response?.data?.error) {
            errorMessage = error.response.data.error;
          } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.message) {
            errorMessage = `导入失败: ${error.message}`;
          }
          
          // 如果是网络错误或服务器错误，提供更友好的提示
          if (error.code === 'NETWORK_ERROR' || error.response?.status >= 500) {
            errorMessage = '服务器连接失败，请稍后重试';
          } else if (error.response?.status === 413) {
            errorMessage = '文件过大，请选择较小的文件';
          } else if (error.response?.status === 400) {
            errorMessage = error.response.data?.error || '请求参数错误，请检查文件格式';
          }
          
          message.error(errorMessage);
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
        
        // 添加空值检查，防止undefined错误
        if (!config) {
          return (
            <Tag color="default">
              {status}
            </Tag>
          );
        }
        
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
                  rowKey={(record) => `validation-error-${record.row ?? Math.random()}`}
                  pagination={{
                    pageSize: 20,
                    pageSizeOptions: ['20', '50'],
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                  }}
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
          pagination={{
            pageSize: 20,
            pageSizeOptions: ['20', '50'],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
          }}
        />
      </Modal>

      {/* 重复数据对比模态框 */}
      <Modal
        title="Duplicate Data Found"
        open={showDuplicateModal}
        onCancel={() => setShowDuplicateModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowDuplicateModal(false)}>
            Cancel
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={handleConfirmDuplicates}
            disabled={duplicateData.some((dup, index) => !duplicateDecisions[`${dup.row || 'unknown'}-${dup.field || 'field'}-${index}`])}
          >
            Continue with Decisions
          </Button>,
        ]}
        width={1000}
      >
        <div className="space-y-4">
          <Alert
            message="Duplicate entries detected"
            description={`Found ${duplicateData.length} duplicate entries. Please decide whether to replace or skip each one.`}
            type="warning"
            showIcon
          />
          
          {/* 批量操作按钮 */}
          <div className="flex gap-3 p-4 bg-gray-50 rounded-lg border">
            <div className="flex-1">
              <Text strong className="text-gray-700">Batch Operations:</Text>
              <div className="text-sm text-gray-500 mt-1">
                Apply the same action to all {duplicateData.length} duplicate entries
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="default"
                icon={<span className="text-blue-600">🔄</span>}
                onClick={handleReplaceAll}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                Replace All
              </Button>
              <Button
                type="default"
                icon={<span className="text-gray-600">⏭️</span>}
                onClick={handleSkipAll}
                className="border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Skip All
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            {duplicateData.map((duplicate, index) => {
              const duplicateKey = `${duplicate.row || 'unknown'}-${duplicate.field || 'field'}-${index}`;
              const decision = duplicateDecisions[duplicateKey];
              
              return (
                <Card key={duplicateKey} size="small" className="border-l-4 border-l-orange-400">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Title level={5} className="mb-0">
                        Row {duplicate.row} - Duplicate {duplicate.field}: {duplicate.value}
                      </Title>
                      <Radio.Group
                        name={duplicateKey}
                        value={decision}
                        onChange={(e) => handleDuplicateDecision(duplicateKey, e.target.value)}
                      >
                        <Radio.Button value="replace" className="text-blue-600">
                          Replace
                        </Radio.Button>
                        <Radio.Button value="skip" className="text-gray-600">
                          Skip
                        </Radio.Button>
                      </Radio.Group>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-red-50 p-3 rounded border">
                        <Text strong className="text-red-700">Existing Data:</Text>
                        <div className="mt-2 text-sm">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(duplicate.existingData, null, 2)}
                          </pre>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 p-3 rounded border">
                        <Text strong className="text-green-700">New Data:</Text>
                        <div className="mt-2 text-sm">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(duplicate.newData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
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
                  pagination={{
                    pageSize: 20,
                    pageSizeOptions: ['20', '50'],
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                  }}
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