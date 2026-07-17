import { UserInfoResponse } from '@/types/userinfo';
import { STORAGE_TOKEN_KEY, STORAGE_USERINFO_KEY } from '@/utils/constants/index';
import { LogoutOutlined } from '@ant-design/icons';
import { Avatar, Tooltip } from 'antd';
import cls from 'classnames';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

function UserBar({ onlyAvatar = false }) {
  const [userInfo, setUserInfo] = useState<UserInfoResponse>();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem(STORAGE_USERINFO_KEY) ?? '');
      setUserInfo(user);
    } catch {
      return undefined;
    }
  }, []);

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USERINFO_KEY);
    router.push('/login');
  };

  return (
    <div className='flex flex-1 items-center justify-center'>
      <div
        className={cls('flex items-center group w-full', {
          'justify-center': onlyAvatar,
          'justify-between': !onlyAvatar,
        })}
      >
        <span className='flex gap-2 items-center'>
          <Avatar src={userInfo?.avatar_url} className='bg-icon-gradient cursor-pointer'>
            {userInfo?.nick_name}
          </Avatar>
          <span
            className={cls('text-sm', {
              hidden: onlyAvatar,
            })}
          >
            {userInfo?.nick_name}
          </span>
        </span>
        <Tooltip title={t('logout')}>
          <LogoutOutlined
            onClick={logout}
            className={cls('cursor-pointer opacity-0 transition-all hover:opacity-100 group-hover:opacity-70', {
              hidden: onlyAvatar,
            })}
          />
        </Tooltip>
      </div>
    </div>
  );
}

export default UserBar;
