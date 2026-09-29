<?php
declare(strict_types=1);
namespace App;

/** RFC 6238 codes for authenticator apps: SHA-1, 6 digits, 30-second steps. */
final class Totp {
    private const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    public static function secret(): string {return self::encode(random_bytes(20));}
    public static function encode(string $bytes): string {
        $bits='';foreach(str_split($bytes) as $byte)$bits.=str_pad(decbin(ord($byte)),8,'0',STR_PAD_LEFT);
        $text='';foreach(str_split($bits,5) as $chunk)$text.=self::ALPHABET[bindec(str_pad($chunk,5,'0'))];
        return $text;
    }
    public static function decode(string $text): string {
        $bits='';foreach(str_split(strtoupper(rtrim($text,'='))) as $char) {
            $value=strpos(self::ALPHABET,$char);
            if($value===false)throw new \InvalidArgumentException('Invalid base32 secret.');
            $bits.=str_pad(decbin($value),5,'0',STR_PAD_LEFT);
        }
        $bytes='';foreach(str_split($bits,8) as $chunk)if(strlen($chunk)===8)$bytes.=chr(bindec($chunk));
        return $bytes;
    }
    public static function code(string $secret,int $step): string {
        $hash=hash_hmac('sha1',pack('J',$step),self::decode($secret),true);
        $offset=ord($hash[19])&0xf;
        return str_pad((string)((unpack('N',substr($hash,$offset,4))[1]&0x7fffffff)%1000000),6,'0',STR_PAD_LEFT);
    }
    /** The matched time step, allowing one step of clock drift. Steps up to $used are spent. */
    public static function verify(string $secret,string $code,int $used,?int $now=null): ?int {
        if(!preg_match('/^[0-9]{6}$/D',$code))return null;
        $step=intdiv($now??time(),30);
        foreach([$step,$step-1,$step+1] as $candidate)if($candidate>$used&&hash_equals(self::code($secret,$candidate),$code))return $candidate;
        return null;
    }
    public static function uri(string $issuer,string $account,string $secret): string {
        return 'otpauth://totp/'.rawurlencode($issuer.':'.$account).'?'.http_build_query(['secret'=>$secret,'issuer'=>$issuer,'algorithm'=>'SHA1','digits'=>6,'period'=>30],'','&',PHP_QUERY_RFC3986);
    }
}
