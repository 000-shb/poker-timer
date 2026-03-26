const http = require('http')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')

// 创建HTTP服务器提供静态文件
const server = http.createServer((req, res) => {
  // 确定请求的文件路径
  let filePath = '.' + req.url
  if (filePath === './') {
    filePath = './public/display.html' // 默认显示前台页面
  } else {
    filePath = './public' + req.url
  }

  // 确定文件类型
  const extname = String(path.extname(filePath)).toLowerCase()
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
  }

  const contentType = mimeTypes[extname] || 'application/octet-stream'

  // 读取并返回文件
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404)
        res.end('File not found')
      } else {
        res.writeHead(500)
        res.end('Server error: ' + error.code)
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content, 'utf-8')
    }
  })
})

// 存储应用状态
const appState = {
  levels: [
    { id: 1, small: 100, big: 100, duration: 15 },
    { id: 2, small: 100, big: 200, duration: 15 },
    { id: 3, small: 200, big: 400, duration: 15 },
    { id: 4, small: 300, big: 600, duration: 15 },
    { id: 5, small: 400, big: 800, duration: 15 },
    { id: 6, small: 500, big: 1000, duration: 15 },
    { id: 7, small: 1000, big: 2000, duration: 10 },
    { id: 8, small: 2000, big: 4000, duration: 10 },
    { id: 9, small: 4000, big: 8000, duration: 10 },
    { id: 10, small: 5000, big: 10000, duration: 10 },
    { id: 11, small: 10000, big: 20000, duration: 10 },
    { id: 12, small: 20000, big: 40000, duration: 10 },
  ],
  currentLevel: 1,
  timeRemaining: 15 * 60, // 秒
  isRunning: false,
  timerInterval: null,
  title: '坚果杯日常锦标赛'
}

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server })

// 广播消息给所有客户端
function broadcast (data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data))
    }
  })
}
function startTimer () {
  // 关键修复：如果已在运行或有计时器实例，直接返回
  if (appState.isRunning || appState.timerInterval) return

  appState.isRunning = true
  appState.timerInterval = setInterval(() => {
    appState.timeRemaining--
    if (appState.timeRemaining <= 5 && appState.timeRemaining > 0) {
      // 广播倒计时警告事件（仅在进入5秒时触发一次，避免重复）
      if (appState.timeRemaining === 5) {
        broadcast({
          type: 'countdownWarning', // 自定义事件类型
          data: { remaining: appState.timeRemaining } // 传递剩余秒数
        })
      }
    }
    // 时间到了切换到下一级别
    if (appState.timeRemaining <= 0) {
      nextLevel()
    }

    // 每秒广播一次状态更新
    broadcast({
      type: 'stateUpdate',
      data: getPublicState()
    })
  }, 1000)
}

// 停止计时器
function stopTimer () {
  appState.isRunning = false
  if (appState.timerInterval) {
    clearInterval(appState.timerInterval)
    appState.timerInterval = null
  }
}

// 切换到下一级别
function nextLevel () {
  if (appState.currentLevel < appState.levels.length) {
    appState.currentLevel++
    if (appState.currentLevel === 10) {
      broadcast({
        type: 'updateStyle'
      })
    }
    const currentLevelData = appState.levels.find(l => l.id === appState.currentLevel)
    appState.timeRemaining = currentLevelData.duration * 60
  } else {
    stopTimer()
  }
  broadcast({
    type: 'stateUpdate',
    data: getPublicState()
  })
}

// 获取供前台展示的公共状态
function getPublicState () {
  const currentLevelData = appState.levels.find(l => l.id === appState.currentLevel)
  const nextLevelNum = appState.currentLevel < appState.levels.length ? appState.currentLevel + 1 : 1
  const nextLevelData = appState.levels.find(l => l.id === nextLevelNum)
  return {
    levels: appState.levels,
    currentLevel: appState.currentLevel,
    currentLevelData,
    nextLevel: nextLevelNum,
    nextLevelData,
    timeRemaining: appState.timeRemaining,
    isRunning: appState.isRunning,
    levelsCount: appState.levels.length,
    title: appState.title
  }
}

// 获取完整状态（供后台使用）
function getFullState () {
  return {
    levels: appState.levels,
    ...getPublicState()
  }
}

// 处理WebSocket连接
wss.on('connection', (ws) => {

  // 向新连接的客户端发送当前状态
  ws.send(JSON.stringify({
    type: 'initialState',
    data: getFullState()
  }))

  // 处理客户端消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)

      switch (data.type) {
        case 'startTimer':
          startTimer()
          broadcast({
            type: 'stateUpdate',
            data: getPublicState()
          })
          break

        case 'stopTimer':
          stopTimer()
          broadcast({
            type: 'stateUpdate',
            data: getPublicState()
          })
          break

        case 'resetTimer':
          stopTimer()
          appState.levels = [
            { id: 1, small: 100, big: 100, duration: 15 },
            { id: 2, small: 100, big: 200, duration: 15 },
            { id: 3, small: 200, big: 400, duration: 15 },
            { id: 4, small: 300, big: 600, duration: 15 },
            { id: 5, small: 400, big: 800, duration: 15 },
            { id: 6, small: 500, big: 1000, duration: 15 },
            { id: 7, small: 1000, big: 2000, duration: 10 },
            { id: 8, small: 2000, big: 4000, duration: 10 },
            { id: 9, small: 4000, big: 8000, duration: 10 },
            { id: 10, small: 5000, big: 10000, duration: 10 },
            { id: 11, small: 10000, big: 20000, duration: 10 },
            { id: 12, small: 20000, big: 40000, duration: 10 },
          ]
          appState.timeRemaining = 15 * 60
          appState.currentLevel = 1
          appState.isRunning = false
          appState.timerInterval = null
          broadcast({
            type: 'stateUpdate',
            data: getPublicState()
          })
          break

        case 'nextLevel':
          nextLevel()
          break
        case 'setTitle':
          appState.title = data.data.title
          broadcast({
            type: 'setTitle',
            data: data,
          })
          break
        case 'addLevel':
          const newId = appState.levels.length > 0
            ? Math.max(...appState.levels.map(l => l.id)) + 1
            : 1

          const newLevel = {
            id: newId,
            small: data.data.small,
            big: data.data.big,
            ante: data.data.ante,
            duration: data.data.duration
          }

          appState.levels.push(newLevel)
          appState.levels.sort((a, b) => a.id - b.id) // 确保级别有序
          broadcast({
            type: 'stateUpdate',
            data: getFullState()
          })
          break

        case 'updateLevel':
          const index = appState.levels.findIndex(l => l.id === data.data.id)
          if (index !== -1) {
            appState.levels[index] = {
              ...appState.levels[index],
              ...data.data
            }

            // 如果更新的是当前级别，重新计算剩余时间
            if (data.data.id === appState.currentLevel) {
              appState.timeRemaining = data.data.duration * 60
            }


            broadcast({
              type: 'stateUpdate',
              data: getFullState()
            })
          }
          break

        case 'deleteLevel':
          if (appState.levels.length <= 1) {
            // 至少保留一个级别
            ws.send(JSON.stringify({
              type: 'error',
              message: '至少需要保留一个级别'
            }))
            return
          }

          // 如果删除的是当前级别，自动切换到上一个或第一个级别
          if (data.data.id === appState.currentLevel) {
            appState.currentLevel = appState.levels.length > 1
              ? (data.data.id > 1 ? data.data.id - 1 : 2)
              : 1

            const currentLevelData = appState.levels.find(l => l.id === appState.currentLevel)
            appState.timeRemaining = currentLevelData.duration * 60
          }

          appState.levels = appState.levels.filter(l => l.id !== data.data.id)

          broadcast({
            type: 'stateUpdate',
            data: getFullState()
          })
          break
      }
    } catch (error) {
      console.error('消息处理错误:', error)
    }
  })

  ws.on('close', () => {
    console.log('客户端断开连接')
  })
})

// 启动服务器
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
  console.log(`前台页面: http://localhost:${PORT}/display.html`)
  console.log(`后台页面: http://localhost:${PORT}/admin.html`)
})