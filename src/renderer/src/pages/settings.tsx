import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
// import { CgWebsite } from 'react-icons/cg'
import { IoLogoGithub } from 'react-icons/io5'
import WebdavConfig from '@renderer/components/settings/webdav-config'
import GeneralConfig from '@renderer/components/settings/general-config'
import AdvancedSettings from '@renderer/components/settings/advanced-settings'
import Actions from '@renderer/components/settings/actions'
import ShortcutConfig from '@renderer/components/settings/shortcut-config'
import { FaTelegramPlane } from 'react-icons/fa'
import SiderConfig from '@renderer/components/settings/sider-config'
import SubStoreConfig from '@renderer/components/settings/substore-config'
import AppearanceConfig from '@renderer/components/settings/appearance-confis'
import ConfirmModal from '@renderer/components/base/base-confirm'
import { useState } from 'react'

const openExternal = (url: string): void => {
  void window.electron.ipcRenderer.invoke('openExternal', url)
}

const Settings: React.FC = () => {
  const [modal, setModal] = useState<'github' | 'telegram' | null>(null)
  return (
    <BasePage
      title="应用设置"
      header={
        <>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="app-nodrag"
            onPress={() => setModal('github')}
          >
            <IoLogoGithub className="text-lg" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="app-nodrag"
            onPress={() => setModal('telegram')}
          >
            <FaTelegramPlane className="text-lg" />
          </Button>
        </>
      }
    >
      {modal === 'github' && (
        <ConfirmModal
          onChange={(open) => !open && setModal(null)}
          title="GitHub 仓库"
          description="本软件为 Sparkle 的自用修改版，与上游项目无关。请选择要前往的仓库："
          buttons={[
            {
              key: 'cancel',
              text: '取消',
              variant: 'bordered',
              onPress: () => {}
            },
            {
              key: 'upstream',
              text: '上游仓库',
              variant: 'bordered',
              onPress: () => openExternal('https://github.com/xishang0128/sparkle')
            },
            {
              key: 'fork',
              text: '修改版仓库',
              onPress: () => openExternal('https://github.com/VenenoSix24/sparkle')
            }
          ]}
        />
      )}
      {modal === 'telegram' && (
        <ConfirmModal
          onChange={(open) => !open && setModal(null)}
          title="Telegram"
          description="本修改版没有自己的 Telegram 群。原 Telegram 群为上游作者的社群，仅讨论上游官方版本。"
          buttons={[
            {
              key: 'cancel',
              text: '取消',
              variant: 'bordered',
              onPress: () => {}
            },
            {
              key: 'upstream',
              text: '前往上游群',
              onPress: () => openExternal('https://t.me/atri0828')
            }
          ]}
        />
      )}
      <GeneralConfig />
      <AppearanceConfig />
      <SubStoreConfig />
      <SiderConfig />
      <WebdavConfig />
      <AdvancedSettings />
      <ShortcutConfig />
      <Actions />
    </BasePage>
  )
}

export default Settings
