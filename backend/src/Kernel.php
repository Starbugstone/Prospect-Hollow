<?php
declare(strict_types=1);
namespace App;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;
use Symfony\Component\HttpFoundation\Request;
final class Kernel extends BaseKernel {
    use MicroKernelTrait;
    public function boot(): void {
        // Optional exact proxy IPs/CIDRs. Never trust forwarded Host or client IP.
        $configured=$_ENV['TRUSTED_PROXIES'] ?? getenv('TRUSTED_PROXIES') ?: '';
        $proxies=$configured==='' ? [] : array_map('trim',explode(',',$configured));
        foreach($proxies as $proxy) {
            $parts=explode('/',$proxy);
            $ipv4=filter_var($parts[0],FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)!==false;
            if (count($parts)>2 || !filter_var($parts[0],FILTER_VALIDATE_IP) || (isset($parts[1]) && (!ctype_digit($parts[1]) || (int)$parts[1]>($ipv4 ? 32 : 128)))) throw new \RuntimeException('TRUSTED_PROXIES must contain only proxy IPs or CIDRs.');
        }
        Request::setTrustedProxies($proxies,Request::HEADER_X_FORWARDED_PROTO|Request::HEADER_X_FORWARDED_PORT);
        parent::boot();
    }
}
