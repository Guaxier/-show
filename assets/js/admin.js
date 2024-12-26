new Vue({
    el: '#admin',
    data: {
        banners: [],
        fireworks: [],
        categories: [],
        showAddForm: false,
        editingFirework: null,
        fireworkForm: {
            name: '',
            category: '',
            price: '',
            cover: '',
            details: [],
            video: ''
        },
        selectedBanners: [],
        uploadStatus: {
            show: false,
            message: '',
            type: 'success' // 'success' 或 'error'
        },
        loading: {
            move: false,
            delete: false,
            upload: false
        },
        showCategoryModal: false,
        newCategory: '',
        editingCategory: null,
        showConfirmModal: false,
        confirmModal: {
            title: '',
            message: '',
            onConfirm: null
        },
        editingFireworkId: null,
        editForm: {
            name: '',
            category: '',
            price: ''
        },
        showLinkModal: false,
        editingBanner: null,
        linkForm: {
            type: '',
            value: ''
        },
        isUploadingVideo: false,
        uploadProgress: 0,
        uploadedVideo: null,
        xhr: null,
        isVideoProcessing: false
    },
    methods: {
        async fetchData() {
            try {
                // 添加时间戳防止缓存
                const timestamp = new Date().getTime();
                const [bannersRes, fireworksRes, categoriesRes] = await Promise.all([
                    fetch(`api/api.php?action=banners&t=${timestamp}`),
                    fetch('api/api.php?action=fireworks'),
                    fetch('api/api.php?action=categories')
                ]);
                
                const banners = await bannersRes.json();
                // 为每个banner的url添加时间戳
                this.banners = banners.map(banner => ({
                    ...banner,
                    url: banner.url + '?t=' + timestamp
                }));
                this.fireworks = await fireworksRes.json();
                this.categories = await categoriesRes.json();
            } catch (error) {
                console.error('数据加载失败:', error);
            }
        },
        async uploadFile(file, type) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            
            const response = await fetch('api/api.php?action=upload', {
                method: 'POST',
                body: formData
            });
            return await response.json();
        },
        async uploadBanner(event) {
            const file = event.target.files[0];
            const result = await this.uploadFile(file, 'banners');
            if (result.success) {
                this.banners.push({
                    id: Date.now() + Math.random(),
                    url: result.url
                });
            }
        },
        async uploadCover(event) {
            const file = event.target.files[0];
            const result = await this.uploadFile(file, 'covers');
            if (result.success) {
                this.fireworkForm.cover = result.url;
            }
        },
        async uploadDetails(event) {
            const files = Array.from(event.target.files);
            this.fireworkForm.details = [];
            
            for (const file of files) {
                const result = await this.uploadFile(file, 'details');
                if (result.success) {
                    this.fireworkForm.details.push(result.url);
                }
            }
        },
        async uploadVideo(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.isUploadingVideo = true;
            this.isVideoProcessing = true;
            this.uploadProgress = 0;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'videos');

            try {
                this.xhr = new XMLHttpRequest();
                
                this.xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        this.uploadProgress = Math.round((e.loaded / e.total) * 100);
                    }
                };

                this.xhr.onload = () => {
                    if (this.xhr.status === 200) {
                        const result = JSON.parse(this.xhr.responseText);
                        if (result.success) {
                            this.uploadedVideo = result.url;
                            this.fireworkForm.video = result.url;
                            this.showMessage('视频上传成功', 'success');
                            setTimeout(() => {
                                this.isVideoProcessing = false;
                                this.isUploadingVideo = false;
                            }, 1000);
                        } else {
                            this.showMessage(result.error || '上传失败', 'error');
                            this.isVideoProcessing = false;
                            this.isUploadingVideo = false;
                        }
                    } else {
                        this.showMessage('上传失败', 'error');
                        this.isVideoProcessing = false;
                        this.isUploadingVideo = false;
                    }
                    this.xhr = null;
                };

                this.xhr.onerror = () => {
                    this.showMessage('上传失败', 'error');
                    this.isVideoProcessing = false;
                    this.isUploadingVideo = false;
                    this.xhr = null;
                };

                this.xhr.open('POST', 'api/api.php?action=upload', true);
                this.xhr.send(formData);
            } catch (error) {
                this.showMessage('上传失败: ' + error.message, 'error');
                this.isVideoProcessing = false;
                this.isUploadingVideo = false;
                this.xhr = null;
            }
        },
        async saveFirework() {
            this.fireworkForm.price = parseFloat(this.fireworkForm.price).toFixed(2);
            
            const response = await fetch('api/api.php?action=save-firework', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.fireworkForm)
            });
            
            if (response.ok) {
                this.showAddForm = false;
                this.resetForm();
                await this.fetchData();
            }
        },
        async deleteFirework(id) {
            this.showConfirm(
                '删除烟花',
                '确定要删除这个烟花吗？',
                async () => {
                    try {
                        const response = await fetch(`api/api.php?action=firework&id=${id}`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            await this.fetchData();
                            this.showMessage('删除成功', 'success');
                        } else {
                            throw new Error('删除失败');
                        }
                    } catch (error) {
                        this.showMessage(`删除失败: ${error.message}`, 'error');
                    }
                }
            );
        },
        async deleteBanner(id) {
            this.showConfirm(
                '删除轮播图',
                '确定要删除这张轮播图吗？',
                async () => {
                    try {
                        this.loading.delete = true;
                        const response = await fetch(`api/api.php?action=banner&id=${id}`, {
                            method: 'DELETE'
                        });

                        if (!response.ok) {
                            throw new Error('删除失败');
                        }

                        // 删除成功后，清除该图片的缓存
                        const banner = this.banners.find(b => b.id === id);
                        if (banner) {
                            // 强制浏览器刷新图片缓存
                            const img = new Image();
                            img.src = banner.url + '?t=' + new Date().getTime();
                        }

                        // 重新获取数据而不是直接修改本地数据
                        await this.fetchData();
                        this.showMessage('轮播图删除成功', 'success');
                    } catch (error) {
                        this.showMessage(`删除失败: ${error.message}`, 'error');
                    } finally {
                        this.loading.delete = false;
                    }
                }
            );
        },
        editFirework(firework) {
            this.editingFirework = firework;
            this.fireworkForm = { ...firework };
            this.showAddForm = true;
        },
        resetForm() {
            this.fireworkForm = {
                name: '',
                category: '',
                price: '',
                cover: '',
                details: [],
                video: ''
            };
            this.editingFirework = null;
            this.uploadedVideo = null;
            
            if (this.xhr) {
                this.xhr.abort();
                this.xhr = null;
            }
        },
        handleBannerSelect(event) {
            this.selectedBanners = Array.from(event.target.files);
        },
        showMessage(message, type = 'success') {
            this.uploadStatus = {
                show: true,
                message,
                type
            };
            // 3秒后自动隐藏提示
            setTimeout(() => {
                this.uploadStatus.show = false;
            }, 3000);
        },
        async uploadSelectedBanners() {
            try {
                if (this.selectedBanners.length === 0) {
                    this.showMessage('请先选择图片', 'error');
                    return;
                }

                this.showMessage('正在上传...', 'info');
                let successCount = 0;
                
                for (const file of this.selectedBanners) {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('type', 'banners');
                    
                    const response = await fetch('api/api.php?action=upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        successCount++;
                    }
                }
                
                // 上传完成后强制刷新数据
                await this.fetchData();
                this.selectedBanners = [];
                
                if (successCount === 0) {
                    this.showMessage('上传失败，请重试', 'error');
                } else if (successCount < this.selectedBanners.length) {
                    this.showMessage(`部分上传成功：${successCount}/${this.selectedBanners.length}张`, 'warning');
                } else {
                    this.showMessage(`上传成功：${successCount}张图片`, 'success');
                }
            } catch (error) {
                console.error('上传失败:', error);
                this.showMessage('上传失败：' + error.message, 'error');
            }
        },
        async moveBanner(id, direction) {
            try {
                if (this.loading.move) return;
                
                this.loading.move = true;
                const index = this.banners.findIndex(b => b.id === id);
                let newBanners = [...this.banners];
                
                if (direction === 'up' && index > 0) {
                    [newBanners[index], newBanners[index - 1]] = 
                    [newBanners[index - 1], newBanners[index]];
                } else if (direction === 'down' && index < this.banners.length - 1) {
                    [newBanners[index], newBanners[index + 1]] = 
                    [newBanners[index + 1], newBanners[index]];
                } else {
                    this.loading.move = false;
                    return;
                }

                const response = await fetch('api/api.php?action=save-banners', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newBanners)
                });

                if (!response.ok) {
                    throw new Error('保存顺序失败');
                }

                await this.fetchData();
                this.showMessage(`轮播图${direction === 'up' ? '上移' : '下移'}成功`, 'success');
                
            } catch (error) {
                console.error('移动失败:', error);
                this.showMessage(`轮播图移动失败: ${error.message}`, 'error');
                await this.fetchData();
            } finally {
                this.loading.move = false;
            }
        },
        async saveBannerOrder() {
            try {
                const response = await fetch('api/api.php?action=save-banners', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.banners)
                });
                
                if (!response.ok) {
                    throw new Error('保存顺序失败');
                }

                return true;
            } catch (error) {
                console.error('保存顺序失败:', error);
                throw error;
            }
        },
        isBannerFirst(id) {
            const index = this.banners.findIndex(b => b.id === id);
            return index === 0;
        },
        isBannerLast(id) {
            const index = this.banners.findIndex(b => b.id === id);
            return index === this.banners.length - 1;
        },
        async addCategory() {
            if (!this.newCategory.trim()) {
                this.showMessage('分类名称不能为空', 'error');
                return;
            }

            try {
                const response = await fetch('api/api.php?action=add-category', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: this.newCategory.trim() })
                });

                const result = await response.json();
                if (result.success) {
                    this.categories.push(this.newCategory.trim());
                    this.showMessage('分类添加成功', 'success');
                    this.newCategory = '';
                    this.showCategoryModal = false;
                } else {
                    throw new Error(result.message || '添加失败');
                }
            } catch (error) {
                this.showMessage(`添加失败: ${error.message}`, 'error');
            }
        },
        showConfirm(title, message, onConfirm) {
            this.confirmModal = {
                title,
                message,
                onConfirm: () => {
                    onConfirm();
                    this.showConfirmModal = false;
                }
            };
            this.showConfirmModal = true;
        },
        async deleteCategory(category) {
            this.showConfirm(
                '删除分类',
                `确定要删除分类"${category}"吗？相关烟花的分类将设为"其他"`,
                async () => {
                    try {
                        const response = await fetch('api/api.php?action=delete-category', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ name: category })
                        });

                        const result = await response.json();
                        if (result.success) {
                            this.categories = this.categories.filter(c => c !== category);
                            this.showMessage('分类删除成功', 'success');
                        } else {
                            throw new Error(result.message || '删除失败');
                        }
                    } catch (error) {
                        this.showMessage(`删除失败: ${error.message}`, 'error');
                    }
                }
            );
        },
        startEditFirework(firework) {
            this.editingFireworkId = firework.id;
            this.editForm = {
                name: firework.name,
                category: firework.category,
                price: firework.price
            };
        },
        saveFireworkEdit(id) {
            this.showConfirm(
                '保存修改',
                '确定要保存烟花信息的修改吗？',
                async () => {
                    try {
                        this.editForm.price = parseFloat(this.editForm.price).toFixed(2);
                        
                        const response = await fetch('api/api.php?action=edit-firework', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                id,
                                ...this.editForm
                            })
                        });

                        const result = await response.json();
                        if (result.success) {
                            this.showMessage('修改成功', 'success');
                            await this.fetchData();
                        } else {
                            throw new Error(result.message || '修改失败');
                        }
                    } catch (error) {
                        this.showMessage(`修改失败: ${error.message}`, 'error');
                    }
                    this.cancelEdit();
                }
            );
        },
        cancelEdit() {
            this.editingFireworkId = null;
            this.editForm = {
                name: '',
                category: '',
                price: ''
            };
        },
        editBannerLink(banner) {
            this.editingBanner = banner;
            this.linkForm = {
                type: banner.linkType || '',
                value: banner.linkValue || ''
            };
            this.showLinkModal = true;
        },
        async saveBannerLink() {
            this.showConfirm(
                '保存链接',
                '确定要保存轮播图链接设置吗？',
                async () => {
                    try {
                        if (this.linkForm.type === 'url' && this.linkForm.value && !this.isValidUrl(this.linkForm.value)) {
                            throw new Error('请输入有效的URL地址');
                        }

                        const updatedBanner = {
                            ...this.editingBanner,
                            linkType: this.linkForm.type,
                            linkValue: this.linkForm.value
                        };

                        const response = await fetch('api/api.php?action=update-banner', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(updatedBanner)
                        });

                        const result = await response.json();
                        if (result.success) {
                            const index = this.banners.findIndex(b => b.id === this.editingBanner.id);
                            if (index !== -1) {
                                this.$set(this.banners, index, updatedBanner);
                            }
                            this.showMessage('链接设置成功', 'success');
                            this.showLinkModal = false;
                        } else {
                            throw new Error(result.message || '保存失败');
                        }
                    } catch (error) {
                        this.showMessage(`保存失败: ${error.message}`, 'error');
                    }
                }
            );
        },
        isValidUrl(string) {
            try {
                new URL(string);
                return true;
            } catch (_) {
                return false;
            }
        },
        // 清理链接表单
        clearLinkForm() {
            this.linkForm = {
                type: '',
                value: ''
            };
            this.editingBanner = null;
            this.showLinkModal = false;
        },
        async cancelForm() {
            if (this.isUploadingVideo) {
                this.showMessage('请等待视频上传完成', 'warning');
                return;
            }

            if (this.uploadedVideo) {
                try {
                    const response = await fetch('api/api.php?action=delete-file', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            path: this.uploadedVideo,
                            type: 'video'
                        })
                    });

                    if (!response.ok) {
                        console.error('删除视频文件失败');
                    }
                } catch (error) {
                    console.error('删除视频文件失败:', error);
                }
            }

            this.showAddForm = false;
            this.resetForm();
        }
    },
    mounted() {
        this.fetchData();
    }
}); 