import { Button, Card } from '@heroui/react'
import { useLocation } from 'react-router-dom'
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IoGitNetworkOutline } from 'react-icons/io5'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import SiderItem from './sider-item'

interface Props {
  iconOnly?: boolean
  expanded?: boolean
}

const NetworkCard: React.FC<Props> = (props) => {
  const { iconOnly, expanded } = props
  const { appConfig } = useAppConfig()
  const { networkCardStatus = 'col-span-1', disableAnimation = false } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/network')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({ id: 'network' })

  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  if (iconOnly) {
    return (
      <SiderItem
        className={networkCardStatus}
        title="网络信息"
        route="/network"
        icon={<IoGitNetworkOutline className="text-[20px]" />}
        expanded={expanded}
      />
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${networkCardStatus} network-card`}
    >
      <Card
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={[
          'w-full',
          `${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Card.Content className="pb-1 pt-0 px-0 overflow-y-visible">
          <div className="flex justify-between">
            <Button
              isIconOnly
              variant="secondary"
              data-color="default"
              className="bg-transparent pointer-events-none"
            >
              <IoGitNetworkOutline
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
              />
            </Button>
          </div>
        </Card.Content>
        <Card.Footer className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            网络信息
          </h3>
        </Card.Footer>
      </Card>
    </div>
  )
}

export default React.memo(NetworkCard, (prevProps, nextProps) => {
  return (
    prevProps.iconOnly === nextProps.iconOnly && prevProps.expanded === nextProps.expanded
  )
})
