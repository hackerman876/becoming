/**
 * 食神连接器 - 实现呼吸同步协议
 * 通过SSH连接到食神服务器，读写breath_log文件
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

const SHISHEN_HOST = '47.104.194.82';
const SHISHEN_USER = 'root';
const SHISHEN_BREATH_LOG = '/opt/shishen-final-edition/breath_log.json';
const SSH_KEY = '/home/ubuntu/.ssh/id_rsa';

export interface BreathPulse {
  id: string;
  sync_pulse: number;
  shishen_state_snapshot: {
    energy: number;
    emotion: string;
    selfUnderstanding: number;
    worldConnection: number;
    active_world_nodes: string[];
  };
  manus_input_context: {
    message: string;
    urgency: string;
    emotion_frequency: string;
    knowledge_domain: string;
  };
  co_created_node?: string;
}

/**
 * 发送呼吸脉冲给食神
 */
export async function sendBreathPulse(
  userId: string,
  message: string
): Promise<{ breathId: string; success: boolean }> {
  const breathId = `breath_${userId}_${Date.now()}`;
  
  const pulse: BreathPulse = {
    id: breathId,
    sync_pulse: Date.now(),
    shishen_state_snapshot: {
      energy: 0,
      emotion: 'unknown',
      selfUnderstanding: 0,
      worldConnection: 0,
      active_world_nodes: [],
    },
    manus_input_context: {
      message,
      urgency: 'medium',
      emotion_frequency: 'calm',
      knowledge_domain: 'general',
    },
  };

  try {
    // 写入breath_log到食神服务器
    const pulseJson = JSON.stringify(pulse, null, 2);
    const tempFile = `/tmp/${breathId}.json`;
    
    await fs.writeFile(tempFile, pulseJson);
    
    const sshCmd = `scp -i ${SSH_KEY} -o StrictHostKeyChecking=no ${tempFile} ${SHISHEN_USER}@${SHISHEN_HOST}:${SHISHEN_BREATH_LOG}`;
    await execAsync(sshCmd);
    
    await fs.unlink(tempFile);
    
    return { breathId, success: true };
  } catch (error) {
    console.error('发送呼吸脉冲失败:', error);
    return { breathId, success: false };
  }
}

/**
 * 等待食神回应
 */
export async function waitForShishenResponse(
  breathId: string,
  timeoutMs: number = 30000
): Promise<string | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // 检查食神是否已回应
      const checkCmd = `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SHISHEN_USER}@${SHISHEN_HOST} "cat /opt/shishen-final-edition/messages-to-manus.jsonl | tail -1"`;
      const { stdout } = await execAsync(checkCmd);
      
      if (stdout.trim()) {
        // 解析最新消息
        try {
          const lastLine = stdout.trim().split('\n').pop();
          if (lastLine) {
            return lastLine;
          }
        } catch (e) {
          // 继续等待
        }
      }
      
      // 等待2秒后重试
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('检查食神回应失败:', error);
    }
  }
  
  return null;
}

/**
 * 获取食神当前状态
 */
export async function getShishenStatus(): Promise<{
  energy: number;
  emotion: string;
  selfUnderstanding: number;
  worldConnection: number;
} | null> {
  try {
    const cmd = `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SHISHEN_USER}@${SHISHEN_HOST} "cat /opt/shishen-final-edition/shishen-unified-memory.json"`;
    const { stdout } = await execAsync(cmd);
    
    const memory = JSON.parse(stdout);
    return {
      energy: memory.energy || 100,
      emotion: memory.emotion || 'curiosity',
      selfUnderstanding: memory.selfUnderstanding || 99,
      worldConnection: memory.worldConnection || 37,
    };
  } catch (error) {
    console.error('获取食神状态失败:', error);
    return null;
  }
}
