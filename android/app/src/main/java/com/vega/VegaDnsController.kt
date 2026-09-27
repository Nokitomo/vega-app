package com.vega

import android.content.Context
import android.util.Log
import com.facebook.react.modules.network.OkHttpClientProvider
import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import okhttp3.Dns
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps

data class VegaDnsProvider(
  val id: String,
  val name: String,
  val url: String? = null,
  val bootstrapAddresses: List<String> = emptyList(),
)

/**
 * App-scoped DNS controller for React Native networking and react-native-video.
 *
 * The controller is installed before React Native starts. The OkHttp client keeps this
 * controller as its DNS implementation, so changing provider affects new connections without
 * rebuilding the React bridge. Existing in-flight calls are deliberately left untouched.
 */
object VegaDnsController : Dns {
  private const val TAG = "VegaDnsController"
  private const val PREFS_NAME = "vega_dns_preferences"
  private const val PROVIDER_KEY = "selected_provider"
  private const val DEFAULT_PROVIDER_ID = "system"
  private const val DNS_TIMEOUT_SECONDS = 10L

  val providers: List<VegaDnsProvider> = listOf(
    VegaDnsProvider(id = "system", name = "System"),
    VegaDnsProvider(
      id = "cloudflare",
      name = "Cloudflare",
      url = "https://cloudflare-dns.com/dns-query",
      bootstrapAddresses = listOf(
        "1.1.1.1",
        "1.0.0.1",
        "2606:4700:4700::1111",
        "2606:4700:4700::1001",
      ),
    ),
    VegaDnsProvider(
      id = "google",
      name = "Google",
      url = "https://dns.google/dns-query",
      bootstrapAddresses = listOf(
        "8.8.8.8",
        "8.8.4.4",
        "2001:4860:4860::8888",
        "2001:4860:4860::8844",
      ),
    ),
    VegaDnsProvider(
      id = "quad9",
      name = "Quad9 (unfiltered)",
      url = "https://dns10.quad9.net/dns-query",
      bootstrapAddresses = listOf(
        "9.9.9.10",
        "149.112.112.10",
        "2620:fe::10",
        "2620:fe::fe:10",
      ),
    ),
  )

  private lateinit var appContext: Context

  @Volatile
  private var selectedProviderId: String = DEFAULT_PROVIDER_ID

  private val dohResolvers = ConcurrentHashMap<String, Dns>()

  fun install(context: Context) {
    appContext = context.applicationContext
    selectedProviderId = readStoredProviderId()

    OkHttpClientProvider.setOkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder(appContext)
        .dns(this)
        .build()
    }

    Log.i(TAG, "Installed app-scoped DNS provider=$selectedProviderId")
  }

  fun getSelectedProviderId(): String = selectedProviderId

  fun setSelectedProvider(providerId: String) {
    require(findProvider(providerId) != null) { "Unsupported DNS provider: $providerId" }

    selectedProviderId = providerId
    appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(PROVIDER_KEY, providerId)
      .apply()

    // Idle connections may still point at addresses resolved by the previous provider.
    // Active requests are not cancelled; subsequent connections use the new resolver.
    runCatching { OkHttpClientProvider.getOkHttpClient().connectionPool.evictAll() }
      .onFailure { error -> Log.w(TAG, "Unable to evict idle HTTP connections", error) }

    Log.i(TAG, "Selected app-scoped DNS provider=$providerId")
  }

  @Throws(UnknownHostException::class)
  override fun lookup(hostname: String): List<InetAddress> {
    if (hostname.isBlank()) {
      throw UnknownHostException("hostname is empty")
    }

    val provider = findProvider(selectedProviderId) ?: providers.first()
    if (provider.id == DEFAULT_PROVIDER_ID) {
      return Dns.SYSTEM.lookup(hostname)
    }

    return resolverFor(provider).lookup(hostname)
  }

  private fun readStoredProviderId(): String {
    val stored = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(PROVIDER_KEY, DEFAULT_PROVIDER_ID)
      .orEmpty()
    return findProvider(stored)?.id ?: DEFAULT_PROVIDER_ID
  }

  private fun findProvider(providerId: String): VegaDnsProvider? =
    providers.firstOrNull { provider -> provider.id == providerId }

  private fun resolverFor(provider: VegaDnsProvider): Dns =
    dohResolvers.getOrPut(provider.id) {
      val endpoint = requireNotNull(provider.url) { "Missing DoH endpoint for ${provider.id}" }
      val bootstrapHosts = provider.bootstrapAddresses.map(InetAddress::getByName)
      val bootstrapClient = OkHttpClient.Builder()
        .dns(Dns.SYSTEM)
        .connectTimeout(DNS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(DNS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(DNS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()

      DnsOverHttps.Builder()
        .client(bootstrapClient)
        .url(endpoint.toHttpUrl())
        .bootstrapDnsHosts(bootstrapHosts)
        .build()
    }
}
