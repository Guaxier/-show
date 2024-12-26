<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// 数据文件路径
define('UPLOAD_PATH', 'uploads/');
define('FIREWORKS_FILE', dirname(dirname(__FILE__)) . '/data/fireworks.json');
define('BANNERS_FILE', dirname(dirname(__FILE__)) . '/data/banners.json');

// 在文件开头添加错误处理
error_reporting(E_ALL);
ini_set('display_errors', 0);

// 在文件开头添加
ini_set('upload_max_filesize', '64M');
ini_set('post_max_size', '64M');
ini_set('max_execution_time', '300');
ini_set('max_input_time', '300');

// 添加错误处理函数
function handleError($message) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

// 处理请求
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

function readJsonFile($file) {
    if (file_exists($file)) {
        return json_decode(file_get_contents($file), true);
    }
    return [];
}

function writeJsonFile($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

// 添加一个函数来获取和更新文件ID
function getNextFileId($type) {
    $idFile = dirname(dirname(__FILE__)) . '/data/file_ids.json';
    
    // 如果文件不存在，创建初始数据
    if (!file_exists($idFile)) {
        $ids = [
            'banners' => 1000,
            'covers' => 1000,
            'details' => 1000,
            'videos' => 1000
        ];
        file_put_contents($idFile, json_encode($ids, JSON_PRETTY_PRINT));
    } else {
        $ids = json_decode(file_get_contents($idFile), true);
    }
    
    // 获取当前ID并增加
    $currentId = $ids[$type];
    $ids[$type]++;
    
    // 保存更新后的ID
    file_put_contents($idFile, json_encode($ids, JSON_PRETTY_PRINT));
    
    return $currentId;
}

// 修改文件上传处理函数
function handleFileUpload($file, $type) {
    try {
        // 检查文件大小（64MB = 64 * 1024 * 1024 bytes）
        $maxFileSize = 64 * 1024 * 1024; // 64MB
        if ($file['size'] > $maxFileSize) {
            return ['success' => false, 'error' => '文件大小不能超过64MB'];
        }

        // 参数验证
        if (empty($file) || empty($type)) {
            return ['success' => false, 'error' => '无效的上传参数'];
        }

        // 验证文件类型映射
        $allowedTypes = [
            'banners' => ['jpg', 'jpeg', 'png', 'gif'],
            'covers' => ['jpg', 'jpeg', 'png', 'gif'],
            'details' => ['jpg', 'jpeg', 'png', 'gif'],
            'videos' => ['mp4', 'webm']
        ];

        // 验证上传类型是否有效
        if (!array_key_exists($type, $allowedTypes)) {
            return ['success' => false, 'error' => '无效的上传类型'];
        }

        $targetDir = 'uploads/' . $type . '/';
        $absoluteDir = dirname(dirname(__FILE__)) . '/' . $targetDir;
        
        // 确保目录存在
        if (!file_exists($absoluteDir)) {
            if (!mkdir($absoluteDir, 0777, true)) {
                return ['success' => false, 'error' => '创建目录失败'];
            }
        }
        
        // 验证文件是否成功上传
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return ['success' => false, 'error' => '文件上传失败或未找到文件'];
        }

        // 获取并验证文件扩展名
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedTypes[$type])) {
            return ['success' => false, 'error' => '不支持的文件类型'];
        }
        
        // 使用序号生成文件名
        $fileId = getNextFileId($type);
        $fileName = $fileId . '.' . $extension;
        $targetPath = $absoluteDir . $fileName;
        
        // 移动文件
        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            // 如果是轮播图，返回ID
            if ($type === 'banners') {
                return [
                    'success' => true,
                    'filename' => $fileName,
                    'url' => '/' . $targetDir . $fileName,
                    'id' => $fileId  // 添加ID返回
                ];
            }
            return [
                'success' => true,
                'filename' => $fileName,
                'url' => '/' . $targetDir . $fileName
            ];
        }
        
        return ['success' => false, 'error' => '文件保存失败'];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

// 修改保存轮播图顺序的逻辑
function saveBannerOrder($banners) {
    // 验证数据格式
    if (!is_array($banners)) {
        return false;
    }

    // 确保每个banner都有必要的字段
    foreach ($banners as &$banner) {
        if (!isset($banner['url'])) {
            return false;
        }
        // 确保ID是数字
        if (!isset($banner['id']) || !is_numeric($banner['id'])) {
            $banner['id'] = getNextFileId('banners');
        }
    }

    // 保存数据
    writeJsonFile(BANNERS_FILE, array_values($banners));
    return true;
}

// 修改轮播图文件重组函数
function reorganizeBannerFiles() {
    $banners = readJsonFile(BANNERS_FILE);
    if (empty($banners)) return;

    $bannersDir = UPLOAD_PATH . 'banners/';
    $newBanners = [];
    $nextId = 1000;

    // 按现有顺序重组
    foreach ($banners as $banner) {
        $oldPath = dirname(dirname(__FILE__)) . $banner['url'];
        if (!file_exists($oldPath)) continue;

        // 获取文件扩展名
        $extension = pathinfo($oldPath, PATHINFO_EXTENSION);
        
        // 生成新的文件名和路径
        $newFileName = $nextId . '.' . $extension;
        $newPath = $bannersDir . $newFileName;
        
        // 如果文件名不同，则重命名
        if (basename($oldPath) !== $newFileName) {
            rename($oldPath, $newPath);
            $banner['url'] = '/uploads/banners/' . $newFileName;
        }

        $banner['id'] = $nextId;
        $newBanners[] = $banner;
        $nextId++;
    }

    // 保存更新后的数据
    writeJsonFile(BANNERS_FILE, $newBanners);
    
    // 更新file_ids.json
    $idFile = dirname(dirname(__FILE__)) . '/data/file_ids.json';
    if (file_exists($idFile)) {
        $ids = json_decode(file_get_contents($idFile), true);
        $ids['banners'] = $nextId;
        file_put_contents($idFile, json_encode($ids, JSON_PRETTY_PRINT));
    }

    return $newBanners;
}

switch ($method) {
    case 'GET':
        if ($action === 'fireworks') {
            echo json_encode(readJsonFile(FIREWORKS_FILE));
        } elseif ($action === 'banners') {
            // 只返回数据，不重组文件
            echo json_encode(readJsonFile(BANNERS_FILE) ?: []);
        } elseif ($action === 'search') {
            // 获取并清理搜索查询
            $query = isset($_GET['query']) ? trim($_GET['query']) : '';
            
            // 防注入处理
            $query = htmlspecialchars($query, ENT_QUOTES, 'UTF-8');
            
            if (empty($query)) {
                echo json_encode(['success' => false, 'message' => '搜索词不能为空']);
                break;
            }
            
            // 读取所有烟花数据
            $fireworks = readJsonFile(FIREWORKS_FILE);
            
            // 执行搜索
            $results = array_filter($fireworks, function($firework) use ($query) {
                return mb_stripos($firework['name'], $query) !== false;
            });
            
            echo json_encode([
                'success' => true,
                'results' => array_values($results)
            ]);
        } elseif ($action === 'categories') {
            $categories = readJsonFile(dirname(dirname(__FILE__)) . '/data/categories.json');
            echo json_encode($categories);
        }
        break;

    case 'POST':
        if ($action === 'upload') {
            try {
                // 验证必要参数
                if (!isset($_POST['type']) || !isset($_FILES['file'])) {
                    handleError('缺少必要参数');
                }

                $type = $_POST['type'];
                $file = $_FILES['file'];
                
                $result = handleFileUpload($file, $type);
                if ($result['success'] && $type === 'banners') {
                    // 读取现有轮播图数据
                    $banners = readJsonFile(BANNERS_FILE);
                    // 添加新轮播图
                    $banners[] = [
                        'id' => $result['id'],
                        'url' => $result['url'],
                        'linkType' => '',
                        'linkValue' => ''
                    ];
                    // 保存更新后的数据
                    writeJsonFile(BANNERS_FILE, $banners);
                }
                echo json_encode($result);
            } catch (Exception $e) {
                handleError($e->getMessage());
            }
        } elseif ($action === 'save-firework') {
            $fireworks = readJsonFile(FIREWORKS_FILE);
            $newFirework = json_decode(file_get_contents('php://input'), true);
            $newFirework['id'] = uniqid();
            $fireworks[] = $newFirework;
            writeJsonFile(FIREWORKS_FILE, $fireworks);
            echo json_encode(['success' => true]);
        } elseif ($action === 'save-banners') {
            $banners = json_decode(file_get_contents('php://input'), true);
            $result = saveBannerOrder($banners);
            echo json_encode([
                'success' => $result,
                'message' => $result ? '保存成功' : '保存失败'
            ]);
        } elseif ($action === 'add-category') {
            $data = json_decode(file_get_contents('php://input'), true);
            $categories = readJsonFile(dirname(dirname(__FILE__)) . '/data/categories.json');
            
            if (in_array($data['name'], $categories)) {
                echo json_encode(['success' => false, 'message' => '分类已存在']);
                break;
            }
            
            $categories[] = $data['name'];
            writeJsonFile(dirname(dirname(__FILE__)) . '/data/categories.json', $categories);
            echo json_encode(['success' => true]);
        } elseif ($action === 'delete-category') {
            $data = json_decode(file_get_contents('php://input'), true);
            $categories = readJsonFile(dirname(dirname(__FILE__)) . '/data/categories.json');
            
            // 不允许删除"其他"分类
            if ($data['name'] === '') {
                echo json_encode(['success' => false, 'message' => '不能删除"其他"分类']);
                break;
            }
            
            $categories = array_filter($categories, fn($c) => $c !== $data['name']);
            writeJsonFile(dirname(dirname(__FILE__)) . '/data/categories.json', $categories);
            
            // 更新相关烟花的分类为"其他"
            $fireworks = readJsonFile(FIREWORKS_FILE);
            foreach ($fireworks as &$firework) {
                if ($firework['category'] === $data['name']) {
                    $firework['category'] = '其他';
                }
            }
            writeJsonFile(FIREWORKS_FILE, $fireworks);
            
            echo json_encode(['success' => true]);
        } elseif ($action === 'edit-firework') {
            $data = json_decode(file_get_contents('php://input'), true);
            $fireworks = readJsonFile(FIREWORKS_FILE);
            
            $updated = false;
            foreach ($fireworks as &$firework) {
                if ($firework['id'] === $data['id']) {
                    $firework['name'] = $data['name'];
                    $firework['category'] = $data['category'];
                    $firework['price'] = $data['price'];
                    $updated = true;
                    break;
                }
            }
            
            if ($updated) {
                writeJsonFile(FIREWORKS_FILE, $fireworks);
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => '未找到要修改的烟花']);
            }
        } elseif ($action === 'update-banner') {
            $banner = json_decode(file_get_contents('php://input'), true);
            $banners = readJsonFile(BANNERS_FILE);
            
            $updated = false;
            foreach ($banners as &$b) {
                if ($b['id'] === $banner['id']) {
                    $b['linkType'] = $banner['linkType'];
                    $b['linkValue'] = $banner['linkValue'];
                    $updated = true;
                    break;
                }
            }
            
            if ($updated) {
                writeJsonFile(BANNERS_FILE, array_values($banners));
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => '未找到要更新的轮播图']);
            }
        } elseif ($action === 'delete-file') {
            $data = json_decode(file_get_contents('php://input'), true);
            $filePath = dirname(dirname(__FILE__)) . $data['path'];
            
            if (file_exists($filePath)) {
                unlink($filePath);
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => '文件不存在']);
            }
        }
        break;

    case 'DELETE':
        if ($action === 'firework') {
            $id = $_GET['id'];
            $fireworks = readJsonFile(FIREWORKS_FILE);
            $fireworks = array_filter($fireworks, fn($f) => $f['id'] !== $id);
            writeJsonFile(FIREWORKS_FILE, array_values($fireworks));
            echo json_encode(['success' => true]);
        } elseif ($action === 'banner') {
            $id = $_GET['id'];
            $banners = readJsonFile(BANNERS_FILE);
            
            // 找到要删除的banner
            $bannerToDelete = null;
            foreach ($banners as $banner) {
                if ($banner['id'] == $id) {
                    $bannerToDelete = $banner;
                    break;
                }
            }

            // 如果找到了banner，删除文件
            if ($bannerToDelete) {
                $filePath = dirname(dirname(__FILE__)) . $bannerToDelete['url'];
                if (file_exists($filePath)) {
                    unlink($filePath);
                }
            }

            // 从数组中移除
            $banners = array_filter($banners, fn($b) => $b['id'] != $id);
            $banners = array_values($banners);
            
            // 保存更新后的数据
            writeJsonFile(BANNERS_FILE, $banners);
            
            // 删除后再重组文件
            reorganizeBannerFiles();
            
            echo json_encode(['success' => true]);
        }
        break;
} 