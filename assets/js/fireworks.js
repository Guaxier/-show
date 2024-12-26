new Vue({
    el: '#app',
    data: {
        banners: [],
        fireworks: [],
        currentBannerIndex: 0,
        currentCategory: 'all',
        selectedFirework: null,
        categories: [],
        bannerInterval: null,
        searchQuery: '',
        searchTimeout: null,
        touch: {
            startX: 0,
            endX: 0,
            startY: 0,
            endY: 0,
            isDragging: false
        },
        cosBaseUrl: '存储桶URL',//存储桶连接，用于拼接展示多媒体数据
        page: 1,
        pageSize: 10,
        loading: false,
        hasMore: true,
        observer: null,
        loadingTrigger: null
    },
    computed: {
        filteredFireworks() {
            let result = this.fireworks;
            
            if (this.searchQuery.trim()) {
                const query = this.searchQuery.trim().toLowerCase();
                result = result.filter(f => 
                    f.name.toLowerCase().includes(query)
                );
            }
            
            if (this.currentCategory !== 'all') {
                result = result.filter(f => 
                    f.category === this.currentCategory
                );
            }
            
            return result.slice(0, this.page * this.pageSize);
        },
        currentBanner() {
            return this.banners[this.currentBannerIndex];
        }
    },
    methods: {
        getResourceUrl(url) {
            if (!url) return '';
            return url.replace(/^\/uploads/, `${this.cosBaseUrl}/uploads`);
        },
        async fetchData() {
            try {
                const [bannersRes, fireworksRes, categoriesRes] = await Promise.all([
                    fetch('api/api.php?action=banners'),
                    fetch('api/api.php?action=fireworks'),
                    fetch('api/api.php?action=categories')
                ]);
                
                const banners = await bannersRes.json();
                this.banners = banners.map(banner => ({
                    ...banner,
                    url: this.getResourceUrl(banner.url)
                }));
                
                const fireworks = await fireworksRes.json();
                this.fireworks = fireworks.map(firework => ({
                    ...firework,
                    cover: this.getResourceUrl(firework.cover),
                    video: this.getResourceUrl(firework.video),
                    details: firework.details.map(detail => this.getResourceUrl(detail))
                }));
                
                this.categories = await categoriesRes.json();
                
                if (this.banners.length > 0) {
                    this.startBannerRotation();
                }
            } catch (error) {
                console.error('数据加载失败:', error);
            }
        },
        startBannerRotation() {
            if (this.bannerInterval) {
                clearInterval(this.bannerInterval);
            }
            
            this.bannerInterval = setInterval(() => {
                this.currentBannerIndex = (this.currentBannerIndex + 1) % this.banners.length;
            }, 3000);
        },
        showDetail(firework) {
            this.selectedFirework = { ...firework };
            this.$nextTick(() => {
                const modal = document.querySelector('.detail-modal');
                modal.offsetHeight;
                modal.classList.add('show');
            });
        },
        closeDetail() {
            const modal = document.querySelector('.detail-modal');
            modal.classList.remove('show');
            setTimeout(() => {
                this.selectedFirework = null;
            }, 300);
        },
        handleSearch() {
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }
            
            this.searchTimeout = setTimeout(() => {
                const query = this.searchQuery.trim();
                if (query.length >= 1) {
                    this.searchFireworks(query);
                } else {
                    this.fetchData();
                }
                this.resetList();
            }, 300);
        },
        async searchFireworks(query) {
            try {
                const response = await fetch(`api/api.php?action=search&query=${encodeURIComponent(query)}`);
                const data = await response.json();
                if (data.success) {
                    this.fireworks = data.results;
                } else {
                    await this.fetchData();
                }
            } catch (error) {
                console.error('搜索失败:', error);
                await this.fetchData();
            }
        },
        handleTouchStart(e) {
            this.touch.startX = e.touches[0].clientX;
            this.touch.startY = e.touches[0].clientY;
            this.touch.isDragging = true;
            // 暂停自动轮播
            if (this.bannerInterval) {
                clearInterval(this.bannerInterval);
            }
        },
        handleTouchMove(e) {
            if (!this.touch.isDragging) return;
            
            this.touch.endX = e.touches[0].clientX;
            this.touch.endY = e.touches[0].clientY;

            // 防止垂直滚动时触发轮播图切换
            const deltaX = this.touch.endX - this.touch.startX;
            const deltaY = this.touch.endY - this.touch.startY;
            if (Math.abs(deltaY) > Math.abs(deltaX)) return;

            // 阻止页面滚动
            e.preventDefault();
        },
        handleTouchEnd() {
            if (!this.touch.isDragging) return;
            
            const deltaX = this.touch.endX - this.touch.startX;
            const threshold = window.innerWidth * 0.2; // 20% 的屏幕宽度作为阈值

            if (Math.abs(deltaX) > threshold) {
                if (deltaX > 0) {
                    this.prevBanner();
                } else {
                    this.nextBanner();
                }
            }

            this.touch.isDragging = false;
            // 恢复自动轮播
            this.startBannerRotation();
        },
        handleMouseDown(e) {
            this.touch.startX = e.clientX;
            this.touch.isDragging = true;
            // 暂停自动轮播
            if (this.bannerInterval) {
                clearInterval(this.bannerInterval);
            }
        },
        handleMouseMove(e) {
            if (!this.touch.isDragging) return;
            this.touch.endX = e.clientX;
        },
        handleMouseUp() {
            if (!this.touch.isDragging) return;
            
            const deltaX = this.touch.endX - this.touch.startX;
            const threshold = window.innerWidth * 0.2;

            if (Math.abs(deltaX) > threshold) {
                if (deltaX > 0) {
                    this.prevBanner();
                } else {
                    this.nextBanner();
                }
            }

            this.touch.isDragging = false;
            // 恢复自动轮播
            this.startBannerRotation();
        },
        nextBanner() {
            this.currentBannerIndex = (this.currentBannerIndex + 1) % this.banners.length;
        },
        prevBanner() {
            this.currentBannerIndex = (this.currentBannerIndex - 1 + this.banners.length) % this.banners.length;
        },
        setCurrentBanner(index) {
            this.currentBannerIndex = index;
            // 重置自动轮播
            this.startBannerRotation();
        },
        clearSearch() {
            this.searchQuery = '';
            this.fetchData(); // 重新获取所有数据
        },
        scrollToActiveCategory() {
            if (!this.$refs.categoryContainer) return;
            
            const container = this.$refs.categoryContainer;
            const activeItem = container.querySelector('.active');
            
            if (activeItem) {
                const containerWidth = container.offsetWidth;
                const itemLeft = activeItem.offsetLeft;
                const itemWidth = activeItem.offsetWidth;
                
                // 计算滚动位置，使选中项居中
                const scrollLeft = itemLeft - (containerWidth / 2) + (itemWidth / 2);
                
                container.scrollTo({
                    left: scrollLeft,
                    behavior: 'smooth'
                });
            }
        },
        handleBannerClick(banner) {
            if (!banner.linkType) return;
            
            if (banner.linkType === 'url') {
                window.open(banner.linkValue, '_blank');
            } else if (banner.linkType === 'product') {
                const firework = this.fireworks.find(f => f.id === banner.linkValue);
                if (firework) {
                    this.showDetail(firework);
                }
            }
        },
        showFullImage(imgUrl) {
            // 创建全屏预览
            const preview = document.createElement('div');
            preview.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                cursor: pointer;
            `;
            
            const img = document.createElement('img');
            img.src = imgUrl;
            img.style.cssText = `
                max-width: 90%;
                max-height: 90vh;
                object-fit: contain;
            `;
            
            preview.appendChild(img);
            preview.onclick = () => document.body.removeChild(preview);
            document.body.appendChild(preview);
        },
        handleImageError(e) {
            console.error('图片加载失败:', e.target.src);
            // 可以在这里添加默认图片
            // e.target.src = '/assets/images/default.jpg';
        },
        initIntersectionObserver() {
            this.observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && !this.loading && this.hasMore) {
                    this.loadMore();
                }
            }, {
                threshold: 0.1
            });

            // 创建并观察加载触发器
            this.$nextTick(() => {
                this.loadingTrigger = document.querySelector('.loading-trigger');
                if (this.loadingTrigger) {
                    this.observer.observe(this.loadingTrigger);
                }
            });
        },

        async loadMore() {
            if (this.loading || !this.hasMore) return;
            
            this.loading = true;
            
            try {
                // 模拟加载延迟
                await new Promise(resolve => setTimeout(resolve, 300));
                
                const totalItems = this.fireworks.length;
                const currentlyShown = this.page * this.pageSize;
                
                if (currentlyShown >= totalItems) {
                    this.hasMore = false;
                } else {
                    this.page++;
                }
            } finally {
                this.loading = false;
            }
        },

        resetList() {
            this.page = 1;
            this.hasMore = true;
            this.loading = false;
        }
    },
    watch: {
        currentCategory() {
            this.resetList();
            this.$nextTick(() => {
                this.scrollToActiveCategory();
            });
        }
    },
    mounted() {
        this.fetchData();
        this.initIntersectionObserver();
    },
    beforeDestroy() {
        if (this.bannerInterval) {
            clearInterval(this.bannerInterval);
        }
        // 清理 observer
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}); 